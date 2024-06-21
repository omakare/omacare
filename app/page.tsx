'use client';
import { useState, FormEvent, ChangeEvent } from 'react';

type ModelType = 'all' | 'chatgpt' | 'haiku' | 'ollama' | 'claude-chatgpt';
type TabType = 'careGroups' | 'patientWebinars' | 'research' | 'grants';
type ResponseType = {
  chatgpt?: string;
  haiku?: string;
  ollama?: string;
};

const USE_CASE_INTROS = {
  careGroups: "Find support and care groups for various medical conditions in specific locations.",
  patientWebinars: "Analyze patient webinars to extract key information, speakers, and topics discussed.",
  research: "Get insights on medical research topics from the perspective of top researchers in the field.",
  grants: "Discover financial support and grant opportunities for medical conditions and assistance with applications."
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('careGroups');
  const [prompt, setPrompt] = useState<string>("Find me care hypophosphatasia groups in my zip code 94102");
  const [responses, setResponses] = useState<ResponseType>({ chatgpt: '', haiku: '', ollama: '' });
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('all');
  const [videoUrl, setVideoUrl] = useState<string>('https://www.youtube.com/watch?v=NVCcgHXSAJk');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResponses({ chatgpt: '', haiku: '', ollama: '' });

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: selectedModel, useCase: activeTab, videoUrl }),
      });

      if (!res.ok) throw new Error('Failed to fetch');

      const data: ResponseType = await res.json();
      setResponses(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (newTab: TabType) => {
    setActiveTab(newTab);
    if (newTab === 'careGroups') {
      setPrompt("Find me care hypophosphatasia groups in my zip code 94102");
    } else if (newTab === 'research') {
      setPrompt("How is Hypophosphatasia inherited?");
    } else if (newTab === 'grants') {
      setPrompt("Find me financial support grants which are available for my location 94102, and assist me in filing them");
    } else {
      setPrompt("");
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'careGroups':
      case 'research':
      case 'grants':
        return (
          <textarea
            value={prompt}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
            className="w-full p-2 border rounded mb-4"
            rows={4}
            placeholder={activeTab === 'careGroups' ? "Enter a location to find care groups" :
                         activeTab === 'research' ? "Enter a research question" :
                         "Enter details for grant applications"}
          />
        );
      case 'patientWebinars':
        return (
          <input
            type="text"
            value={videoUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setVideoUrl(e.target.value)}
            className="w-full p-2 border rounded mb-4"
            placeholder="Enter YouTube video URL"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-2 text-center">Omacare</h1>
      <p className="text-xl mb-8 text-center text-gray-600">Omakase for your Care</p>
      
      <div className="mb-4">
        <div className="flex border-b">
          {['Care Groups', 'Patient Webinars', 'Research', 'Grants'].map((tab, index) => (
            <button
              key={tab}
              className={`py-2 px-4 ${activeTab === ['careGroups', 'patientWebinars', 'research', 'grants'][index] ? 'border-b-2 border-blue-500' : ''}`}
              onClick={() => handleTabChange(['careGroups', 'patientWebinars', 'research', 'grants'][index] as TabType)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600">{USE_CASE_INTROS[activeTab]}</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <label htmlFor="model-select" className="block mb-2">Select Model:</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedModel(e.target.value as ModelType)}
            className="w-full p-2 border rounded"
          >
            <option value="all">All Models</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="haiku">Claude 3 Haiku</option>
            <option value="ollama">Ollama</option>
            <option value="claude-chatgpt">Claude and ChatGPT</option>
          </select>
        </div>
        {renderTabContent()}
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          disabled={loading || (!prompt && !videoUrl)}
        >
          {loading ? 'Processing...' : 'Generate Response'}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['chatgpt', 'haiku', 'ollama'] as const).map((model) => (
          <div key={model} className={`p-4 border rounded ${
            (selectedModel !== 'all' && selectedModel !== model && selectedModel !== 'claude-chatgpt') || 
            (selectedModel === 'claude-chatgpt' && model === 'ollama') ? 'hidden' : ''
          }`}>
            <h2 className="text-xl font-semibold mb-2 capitalize">{model}</h2>
            <p className="p-2 bg-gray-100 rounded min-h-[100px] whitespace-pre-wrap">{responses[model] || 'No response yet'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}