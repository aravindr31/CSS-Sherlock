const AI_ENDPOINTS = {
    openai: 'https://api.openai.com/v1/chat/completions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
    claude: 'https://api.anthropic.com/v1/messages',
    ollama: '/api/generate'
};

// Cache for storing API keys and configurations
let aiConfigCache = {};

// Load configuration from storage
chrome.storage.local.get(['dom-inspector-ai-config'], (result) => {
    if (result['dom-inspector-ai-config']) {
        aiConfigCache = result['dom-inspector-ai-config'];
    }
});

// Listen for configuration updates
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes['dom-inspector-ai-config']) {
        aiConfigCache = changes['dom-inspector-ai-config'].newValue;
    }
});

// Handle AI API requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'callAI') {
        handleAIRequest(request)
            .then(response => sendResponse({ success: true, response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
    }
});

async function handleAIRequest(request) {
    const { provider, prompt, model, apiKey, baseUrl } = request;
    
    try {
        switch (provider) {
            case 'openai':
                return await callOpenAI(prompt, apiKey, model);
            case 'gemini':
                return await callGemini(prompt, apiKey, model);
            case 'claude':
                return await callClaude(prompt, apiKey, model);
            case 'ollama':
                return await callOllama(prompt, model, baseUrl);
            default:
                throw new Error('Unsupported AI provider');
        }
    } catch (error) {
        console.error('AI API call failed:', error);
        throw error;
    }
}

async function callOpenAI(prompt, apiKey, model) {
    const response = await fetch(AI_ENDPOINTS.openai, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert web developer assistant. Help analyze HTML elements, CSS, and provide web development insights. Keep responses concise and practical.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGemini(prompt, apiKey, model) {
    const response = await fetch(`${AI_ENDPOINTS.gemini}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `You are an expert web developer assistant. Help analyze HTML elements, CSS, and provide web development insights. Keep responses concise and practical.\n\n${prompt}`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function callClaude(prompt, apiKey, model) {
    const response = await fetch(AI_ENDPOINTS.claude, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'x-api-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 1000,
            system: 'You are an expert web developer assistant. Help analyze HTML elements, CSS, and provide web development insights. Keep responses concise and practical.',
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Claude API error');
    }

    const data = await response.json();
    return data.content[0].text;
}

async function callOllama(prompt, model, baseUrl) {
    // For Ollama, we need to handle local URLs carefully
    const url = new URL(AI_ENDPOINTS.ollama, baseUrl).toString();


    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            prompt: `You are an expert web developer assistant. Help analyze HTML elements, CSS, and provide web development insights. Keep responses concise and practical.\n\n${prompt}`,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 1000
            }
        })
    });
    if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
}