'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [responses, setResponses] = useState({ chatgpt: '', haiku: '', ollama: '' });
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('all');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResponses({ chatgpt: '', haiku: '', ollama: '' });

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: selectedModel }),
      });

      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      setResponses(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-2 text-center">Omacare</h1>
      <p className="text-xl mb-8 text-center text-gray-600">Omakase for your Care</p>
      
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <label htmlFor="model-select" className="block mb-2">Select Model:</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="all">All Models</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="haiku">Claude 3 Haiku</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          rows="4"
          placeholder="Enter your prompt here"
        />
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          disabled={loading || !prompt.trim()}
        >
          {loading ? 'Processing...' : 'Generate Response'}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['chatgpt', 'haiku', 'ollama'].map((model) => (
          <div key={model} className={`p-4 border rounded ${selectedModel !== 'all' && selectedModel !== model ? 'hidden' : ''}`}>
            <h2 className="text-xl font-semibold mb-2 capitalize">{model}</h2>
            <p className="p-2 bg-gray-100 rounded min-h-[100px]">{responses[model] || 'No response yet'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}