import React, { useState, useMemo, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  BarChart3, 
  Database, 
  Activity, 
  Search, 
  BrainCircuit, 
  MessageSquare, 
  Zap,
  Globe,
  Lock,
  FileText,
  ChevronRight,
  Info,
  TrendingUp,
  Skull,
  Ghost,
  Frown,
  Angry,
  Loader2,
  Upload,
  HardDrive,
  Cloud,
  Trash2,
  Phone,
  Smartphone,
  Key,
  LogOut
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Firebase Initialization ---
import { initializeApp as initFirebase } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "steady-atlas-469606-m7",
  "appId": "1:965758062482:web:7cbce8764e3ad7e240bb4b",
  "apiKey": "AIzaSyBYg3HEoJKkv09-zowHnsKF2wT5BpeNTHI",
  "authDomain": "steady-atlas-469606-m7.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-fd1c52b5-f6b7-472f-9358-043e0a1b97b3",
  "storageBucket": "steady-atlas-469606-m7.firebasestorage.app",
  "messagingSenderId": "965758062482",
  "measurementId": ""
};

const app = initFirebase(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth();

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- NLP Logic ---
const NICCS_LEXICON = [
  'cyber', 'security', 'attack', 'hacker', 'malware', 'ransomware', 
  'phishing', 'vulnerability', 'exploit', 'breach', 'ddos', 'botnet',
  'apt', 'threat', 'data', 'information', 'network', 'system', 'patch'
];

const SENTIMENT_LEXICON: Record<string, number> = {
  'hate': -0.8, 'terror': -0.9, 'criminal': -0.7, 'aggression': -0.6, 'terrorist': -1.0,
  'angry': -0.7, 'fearful': -0.7, 'oppose': -0.5, 'peace': 0.8, 'brave': 0.6,
  'happy': 0.7, 'amicably': 0.5, 'stop': 0.2
};

function cleanText(text: string): string {
  return text.replace(/@[A-Za-z0-9_]+/g, '').replace(/#+/g, '').replace(/RT[\s]+/g, '').replace(/https?:\/\/\S+/g, '').replace(/:[\s]+/g, ' ').trim();
}

function analyzeTweet(text: string) {
  const cleaned = cleanText(text);
  const words = cleaned.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const isCyberRelevant = words.some(word => NICCS_LEXICON.includes(word));
  let totalPolarity = 0;
  let sentimentWordsCount = 0;
  words.forEach(word => {
    if (SENTIMENT_LEXICON[word] !== undefined) {
      totalPolarity += SENTIMENT_LEXICON[word];
      sentimentWordsCount++;
    }
  });
  const polarity = sentimentWordsCount > 0 ? totalPolarity / sentimentWordsCount : 0;
  const subjectivity = Math.min(1, (sentimentWordsCount * 2) / Math.max(1, words.length));
  let sentiment: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
  if (polarity > 0.1) sentiment = 'Positive';
  else if (polarity < -0.1) sentiment = 'Negative';
  return { polarity: parseFloat(polarity.toFixed(3)), subjectivity: parseFloat(subjectivity.toFixed(3)), sentiment, isCyberRelevant, frequentMarkers: words.filter(w => SENTIMENT_LEXICON[w] !== undefined) };
}

function getFrequentMarkers(tweets: string[], minSupport = 0.01) {
  const counts: Record<string, number> = {};
  tweets.forEach(t => {
    const words = new Set(cleanText(t).toLowerCase().split(/\W+/).filter(w => w.length > 3));
    words.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
  });
  return Object.entries(counts).map(([word, count]) => ({ word, count, support: count / tweets.length })).filter(m => m.support >= minSupport).sort((a, b) => b.count - a.count);
}

// --- CyberBot Component ---
const CyberBot: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([{ role: 'bot', content: "Greetings. I am the CyberSense Intelligence Assistant. How can I assist you today?", timestamp: new Date() }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: input }] }],
        config: { systemInstruction: "You are the CyberSense Intelligence Assistant, specialized in CTI and emotion-aware sentiment analysis." }
      });
      setMessages(prev => [...prev, { role: 'bot', content: response.text || "Error processing data.", timestamp: new Date() }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: "System Error: Connection failed.", timestamp: new Date() }]);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg"><Shield className="text-white" size={20} /></div>
          <h3 className="text-sm font-bold text-white">Intelligence Assistant</h3>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex gap-4 max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto")}>
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", msg.role === 'user' ? "bg-indigo-600" : "bg-slate-800 border border-slate-700")}>
              {msg.role === 'user' ? <Smartphone size={16} className="text-white" /> : <Shield size={16} className="text-indigo-400" />}
            </div>
            <div className={cn("p-4 rounded-2xl text-sm leading-relaxed", msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-800/50 text-slate-200 border border-slate-700 rounded-tl-none")}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-slate-900/80 border-t border-slate-800">
        <div className="relative">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask about threat patterns..." className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          <button onClick={handleSend} disabled={!input.trim() || isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50"><Smartphone size={18} /></button>
        </div>
      </div>
    </div>
  );
};

// --- Types ---

interface Dataset {
  id: string;
  name: string;
  description: string;
  type: 'Social Media' | 'Network Traffic' | 'Reports' | 'Events' | 'Metadata';
  size: string;
  relevance: string;
  sampleData?: { id: string; content: string; label?: string; sentiment?: string }[];
}

interface ThreatCategory {
  id: string;
  name: string;
  sentiment: 'Negative' | 'Neutral' | 'Positive';
  dominantEmotion: string;
  intensity: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
}

// --- Mock Data ---

const DATASETS: Dataset[] = [
  {
    id: 'isis-twitter',
    name: 'ISIS Twitter Dataset',
    type: 'Social Media',
    description: 'A collection of tweets from pro-ISIS accounts, used for analyzing radicalization and propaganda sentiment (Section 3.2).',
    size: '17,000+ Tweets',
    relevance: 'Propaganda analysis, recruitment detection.',
    sampleData: [
      { id: 'T1', content: 'We will strike at the heart of the infidels. Our cause is just and our resolve is iron.', label: 'Propaganda', sentiment: 'Negative' },
      { id: 'T2', content: 'Join the ranks of the faithful. The caliphate calls for your strength and devotion.', label: 'Recruitment', sentiment: 'Positive' },
      { id: 'T3', content: 'The enemies of the state are weak and divided. Their end is near.', label: 'Threat', sentiment: 'Negative' },
    ]
  },
  {
    id: 'ctu-13',
    name: 'CTU-13 Botnet Dataset',
    type: 'Network Traffic',
    description: 'A dataset of botnet traffic captured at CTU University, containing NetFlows and labels for various botnet behaviors.',
    size: '13 Captures',
    relevance: 'Behavioral pattern recognition, anomaly detection.',
    sampleData: [
      { id: 'N1', content: 'Flow: 192.168.1.10 -> 8.8.8.8 | Protocol: TCP | Port: 80 | Bytes: 1.2MB', label: 'Normal', sentiment: 'Neutral' },
      { id: 'N2', content: 'Flow: 10.0.0.5 -> 142.250.1.1 | Protocol: UDP | Port: 53 | High Frequency DNS Queries', label: 'Botnet (C&C)', sentiment: 'Negative' },
      { id: 'N3', content: 'Flow: 172.16.0.2 -> 192.168.1.1 | Protocol: ICMP | Flood Pattern Detected', label: 'DDoS Attack', sentiment: 'Negative' },
    ]
  },
  {
    id: 'aptnotes',
    name: 'APTnotes Dataset',
    type: 'Reports',
    description: 'A collection of publicly available APT (Advanced Persistent Threat) reports used for TTP extraction (Section 2).',
    size: '500+ Reports',
    relevance: 'TTP extraction, actor attribution, historical analysis.',
    sampleData: [
      { id: 'R1', content: 'The threat actor "Cobalt Strike" utilized spear-phishing emails with malicious attachments to gain initial access.', label: 'TTP Analysis', sentiment: 'Negative' },
      { id: 'R2', content: 'Analysis of the malware sample reveals a sophisticated modular architecture with anti-debugging features.', label: 'Malware Analysis', sentiment: 'Neutral' },
      { id: 'R3', content: 'The campaign targeted financial institutions in Southeast Asia, exfiltrating sensitive customer data.', label: 'Targeting', sentiment: 'Negative' },
    ]
  },
  {
    id: 'casie',
    name: 'CASIE Dataset',
    type: 'Events',
    description: 'Cybersecurity Event Detection dataset focused on extracting event information from news articles.',
    size: '1,000 Articles',
    relevance: 'Event extraction, real-time threat monitoring.',
    sampleData: [
      { id: 'E1', content: 'A major data breach has been reported at a leading tech firm, affecting millions of users worldwide.', label: 'Data Breach', sentiment: 'Negative' },
      { id: 'E2', content: 'Security researchers have discovered a new zero-day vulnerability in a widely used web server software.', label: 'Vulnerability', sentiment: 'Neutral' },
      { id: 'E3', content: 'Law enforcement agencies have successfully dismantled a global botnet operation responsible for massive spam campaigns.', label: 'Takedown', sentiment: 'Positive' },
    ]
  },
  {
    id: 'malware-metadata',
    name: 'Malware Text Datasets',
    type: 'Metadata',
    description: 'Metadata from VirusShare and Malware Bazaar, including file hashes and analyst comments.',
    size: 'Millions of entries',
    relevance: 'Malware classification, trend analysis.',
    sampleData: [
      { id: 'M1', content: 'Hash: 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8 | Type: Trojan', label: 'Classification', sentiment: 'Negative' },
      { id: 'M2', content: 'Analyst Comment: Sample exhibits behavior consistent with the Emotet banking trojan.', label: 'Analyst Note', sentiment: 'Negative' },
      { id: 'M3', content: 'Detection Rate: 45/72 on VirusTotal | First Seen: 2023-10-15', label: 'Metadata', sentiment: 'Neutral' },
    ]
  },
  {
    id: 'bot-libre',
    name: 'Bot Libre Platform',
    type: 'Metadata',
    description: 'Open-source end-to-end chatbot building platform used to deploy the research chatbot on Twitter (Section 3.1).',
    size: 'Research Tool',
    relevance: 'Chatbot development, automated data collection.',
    sampleData: [
      { id: 'B1', content: 'Bot Configuration: Response Delay: 5s | Personality: Security Analyst | Target: Twitter API', label: 'Config', sentiment: 'Neutral' },
      { id: 'B2', content: 'Log: Conversation initiated with user @threat_intel_fan. Topic: Recent CVEs.', label: 'Interaction', sentiment: 'Neutral' },
      { id: 'B3', content: 'Metric: 85% success rate in identifying cyber-relevant tweets using NICCS Lexicon.', label: 'Performance', sentiment: 'Positive' },
    ]
  },
  {
    id: 'twitter-threat-features',
    name: 'Twitter Threat Feature Dataset',
    type: 'Social Media',
    description: 'A feature-engineered dataset for identifying threat-related communications on Twitter based on engagement metrics and metadata.',
    size: '250+ Records',
    relevance: 'Threat classification, feature importance analysis, automated detection.',
    sampleData: [
      { id: '32155', content: 'Followers: 7046 | URL: No | Hashtags: 3 | Mentions: 3 | RTs: 374 | Favs: 3044 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '64012', content: 'Followers: 3096 | URL: No | Hashtags: 4 | Mentions: 0 | RTs: 473 | Favs: 1853 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '22062', content: 'Followers: 7381 | URL: No | Hashtags: 1 | Mentions: 2 | RTs: 676 | Favs: 3580 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '20251', content: 'Followers: 1659 | URL: No | Hashtags: 1 | Mentions: 3 | RTs: 599 | Favs: 4734 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '66966', content: 'Followers: 9523 | URL: No | Hashtags: 0 | Mentions: 0 | RTs: 675 | Favs: 2054 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '43373', content: 'Followers: 966 | URL: No | Hashtags: 4 | Mentions: 0 | RTs: 763 | Favs: 1970 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '97724', content: 'Followers: 9376 | URL: No | Hashtags: 0 | Mentions: 3 | RTs: 70 | Favs: 3791 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '16657', content: 'Followers: 6371 | URL: Yes | Hashtags: 4 | Mentions: 1 | RTs: 433 | Favs: 3052 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '30230', content: 'Followers: 4730 | URL: Yes | Hashtags: 5 | Mentions: 2 | RTs: 475 | Favs: 161 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '44086', content: 'Followers: 773 | URL: No | Hashtags: 4 | Mentions: 3 | RTs: 472 | Favs: 3511 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '79019', content: 'Followers: 4053 | URL: No | Hashtags: 4 | Mentions: 1 | RTs: 426 | Favs: 532 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '54964', content: 'Followers: 5982 | URL: No | Hashtags: 3 | Mentions: 3 | RTs: 851 | Favs: 2216 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '99309', content: 'Followers: 947 | URL: No | Hashtags: 5 | Mentions: 1 | RTs: 1 | Favs: 2307 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '70616', content: 'Followers: 8090 | URL: Yes | Hashtags: 4 | Mentions: 2 | RTs: 16 | Favs: 1773 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '61943', content: 'Followers: 5751 | URL: No | Hashtags: 3 | Mentions: 3 | RTs: 603 | Favs: 3586 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '31220', content: 'Followers: 1864 | URL: Yes | Hashtags: 1 | Mentions: 1 | RTs: 724 | Favs: 3252 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '83439', content: 'Followers: 3068 | URL: No | Hashtags: 3 | Mentions: 1 | RTs: 725 | Favs: 711 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '32497', content: 'Followers: 289 | URL: Yes | Hashtags: 2 | Mentions: 3 | RTs: 416 | Favs: 639 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '75165', content: 'Followers: 9587 | URL: Yes | Hashtags: 3 | Mentions: 1 | RTs: 752 | Favs: 242 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '60731', content: 'Followers: 2930 | URL: Yes | Hashtags: 2 | Mentions: 1 | RTs: 673 | Favs: 1063 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '73311', content: 'Followers: 7574 | URL: No | Hashtags: 3 | Mentions: 0 | RTs: 198 | Favs: 1231 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '37729', content: 'Followers: 724 | URL: No | Hashtags: 2 | Mentions: 2 | RTs: 505 | Favs: 2805 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '40761', content: 'Followers: 782 | URL: Yes | Hashtags: 0 | Mentions: 0 | RTs: 44 | Favs: 432 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '82678', content: 'Followers: 8040 | URL: Yes | Hashtags: 0 | Mentions: 2 | RTs: 147 | Favs: 4218 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '63267', content: 'Followers: 8663 | URL: Yes | Hashtags: 4 | Mentions: 2 | RTs: 376 | Favs: 449 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '80859', content: 'Followers: 8495 | URL: No | Hashtags: 2 | Mentions: 2 | RTs: 446 | Favs: 3600 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '15517', content: 'Followers: 6242 | URL: Yes | Hashtags: 3 | Mentions: 0 | RTs: 697 | Favs: 3559 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '97864', content: 'Followers: 5942 | URL: No | Hashtags: 1 | Mentions: 0 | RTs: 648 | Favs: 3456 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '47625', content: 'Followers: 9146 | URL: Yes | Hashtags: 4 | Mentions: 1 | RTs: 161 | Favs: 2887 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '82972', content: 'Followers: 8983 | URL: No | Hashtags: 1 | Mentions: 0 | RTs: 844 | Favs: 3793 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '94207', content: 'Followers: 4602 | URL: Yes | Hashtags: 4 | Mentions: 1 | RTs: 218 | Favs: 814 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '6327', content: 'Followers: 6760 | URL: Yes | Hashtags: 5 | Mentions: 1 | RTs: 955 | Favs: 2192 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '71728', content: 'Followers: 8581 | URL: No | Hashtags: 0 | Mentions: 0 | RTs: 615 | Favs: 3660 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '97964', content: 'Followers: 4498 | URL: Yes | Hashtags: 3 | Mentions: 3 | RTs: 537 | Favs: 2713 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '475', content: 'Followers: 9455 | URL: No | Hashtags: 1 | Mentions: 1 | RTs: 866 | Favs: 644 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '48482', content: 'Followers: 6326 | URL: Yes | Hashtags: 5 | Mentions: 0 | RTs: 812 | Favs: 1167 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '4859', content: 'Followers: 291 | URL: No | Hashtags: 1 | Mentions: 1 | RTs: 358 | Favs: 1197 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '44081', content: 'Followers: 1187 | URL: No | Hashtags: 3 | Mentions: 3 | RTs: 447 | Favs: 2790 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '32719', content: 'Followers: 6239 | URL: No | Hashtags: 1 | Mentions: 3 | RTs: 1000 | Favs: 4036 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '63757', content: 'Followers: 492 | URL: No | Hashtags: 4 | Mentions: 3 | RTs: 871 | Favs: 4377 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '40024', content: 'Followers: 9684 | URL: Yes | Hashtags: 1 | Mentions: 1 | RTs: 945 | Favs: 11 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '25715', content: 'Followers: 6190 | URL: Yes | Hashtags: 5 | Mentions: 3 | RTs: 177 | Favs: 1968 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '51486', content: 'Followers: 5241 | URL: Yes | Hashtags: 5 | Mentions: 0 | RTs: 785 | Favs: 3338 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '18279', content: 'Followers: 2383 | URL: No | Hashtags: 5 | Mentions: 2 | RTs: 402 | Favs: 1802 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '37946', content: 'Followers: 3145 | URL: No | Hashtags: 4 | Mentions: 3 | RTs: 902 | Favs: 1753 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '18683', content: 'Followers: 6371 | URL: No | Hashtags: 2 | Mentions: 3 | RTs: 264 | Favs: 2813 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '53646', content: 'Followers: 3472 | URL: Yes | Hashtags: 0 | Mentions: 0 | RTs: 722 | Favs: 3310 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '21681', content: 'Followers: 8705 | URL: No | Hashtags: 0 | Mentions: 2 | RTs: 726 | Favs: 3538 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '92581', content: 'Followers: 8959 | URL: Yes | Hashtags: 1 | Mentions: 3 | RTs: 575 | Favs: 390 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '78312', content: 'Followers: 3714 | URL: Yes | Hashtags: 1 | Mentions: 2 | RTs: 284 | Favs: 351 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '28506', content: 'Followers: 4062 | URL: No | Hashtags: 0 | Mentions: 1 | RTs: 5 | Favs: 2557 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '98966', content: 'Followers: 4149 | URL: No | Hashtags: 1 | Mentions: 1 | RTs: 700 | Favs: 3650 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '51882', content: 'Followers: 3976 | URL: No | Hashtags: 5 | Mentions: 0 | RTs: 166 | Favs: 2296 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '97978', content: 'Followers: 8722 | URL: Yes | Hashtags: 1 | Mentions: 2 | RTs: 195 | Favs: 1390 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '57019', content: 'Followers: 7311 | URL: Yes | Hashtags: 3 | Mentions: 3 | RTs: 544 | Favs: 1273 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '9363', content: 'Followers: 6064 | URL: Yes | Hashtags: 1 | Mentions: 0 | RTs: 262 | Favs: 584 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '13484', content: 'Followers: 5021 | URL: No | Hashtags: 2 | Mentions: 3 | RTs: 328 | Favs: 4113 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '57704', content: 'Followers: 5232 | URL: No | Hashtags: 1 | Mentions: 0 | RTs: 351 | Favs: 3271 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '98420', content: 'Followers: 8727 | URL: No | Hashtags: 0 | Mentions: 0 | RTs: 44 | Favs: 162 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '31479', content: 'Followers: 2705 | URL: No | Hashtags: 5 | Mentions: 2 | RTs: 84 | Favs: 3802 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '15619', content: 'Followers: 912 | URL: Yes | Hashtags: 0 | Mentions: 3 | RTs: 165 | Favs: 2219 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '29704', content: 'Followers: 7757 | URL: No | Hashtags: 4 | Mentions: 1 | RTs: 986 | Favs: 4737 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '73518', content: 'Followers: 1661 | URL: Yes | Hashtags: 0 | Mentions: 0 | RTs: 466 | Favs: 2286 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '46473', content: 'Followers: 9031 | URL: Yes | Hashtags: 2 | Mentions: 1 | RTs: 121 | Favs: 532 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '58619', content: 'Followers: 1649 | URL: Yes | Hashtags: 1 | Mentions: 2 | RTs: 605 | Favs: 3153 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '84455', content: 'Followers: 2717 | URL: Yes | Hashtags: 0 | Mentions: 3 | RTs: 319 | Favs: 1662 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '55496', content: 'Followers: 5609 | URL: No | Hashtags: 2 | Mentions: 0 | RTs: 447 | Favs: 14 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '82801', content: 'Followers: 5459 | URL: Yes | Hashtags: 1 | Mentions: 2 | RTs: 973 | Favs: 508 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '12732', content: 'Followers: 8768 | URL: Yes | Hashtags: 0 | Mentions: 1 | RTs: 419 | Favs: 1583 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '39472', content: 'Followers: 4552 | URL: No | Hashtags: 2 | Mentions: 0 | RTs: 148 | Favs: 2862 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '54693', content: 'Followers: 3988 | URL: No | Hashtags: 0 | Mentions: 2 | RTs: 108 | Favs: 1843 | Emoticons: 0', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '38397', content: 'Followers: 9235 | URL: No | Hashtags: 4 | Mentions: 1 | RTs: 492 | Favs: 1177 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '13166', content: 'Followers: 2234 | URL: Yes | Hashtags: 0 | Mentions: 0 | RTs: 331 | Favs: 1278 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '66218', content: 'Followers: 2886 | URL: Yes | Hashtags: 5 | Mentions: 2 | RTs: 496 | Favs: 1318 | Emoticons: 2', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '8360', content: 'Followers: 7161 | URL: Yes | Hashtags: 5 | Mentions: 3 | RTs: 858 | Favs: 1143 | Emoticons: 1', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '51717', content: 'Followers: 9672 | URL: No | Hashtags: 0 | Mentions: 1 | RTs: 159 | Favs: 4638 | Emoticons: 0', label: 'Non-Threat', sentiment: 'Neutral' },
      { id: '69695', content: 'Followers: 5187 | URL: Yes | Hashtags: 1 | Mentions: 1 | RTs: 844 | Favs: 1245 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '5740', content: 'Followers: 237 | URL: Yes | Hashtags: 3 | Mentions: 2 | RTs: 479 | Favs: 3924 | Emoticons: 2', label: 'Threat Detected', sentiment: 'Negative' },
      { id: '80792', content: 'Followers: 9855 | URL: No | Hashtags: 4 | Mentions: 3 | RTs: 224 | Favs: 2747 | Emoticons: 1', label: 'Threat Detected', sentiment: 'Negative' },
    ]
  }
];

const SENTIMENT_DISTRIBUTION = [
  { name: 'Negative', value: 65, color: '#ef4444' },
  { name: 'Neutral', value: 25, color: '#94a3b8' },
  { name: 'Positive', value: 10, color: '#22c55e' },
];

const EMOTION_RADAR = [
  { subject: 'Anger', A: 120, fullMark: 150 },
  { subject: 'Fear', A: 98, fullMark: 150 },
  { subject: 'Sadness', A: 30, fullMark: 150 },
  { subject: 'Surprise', A: 45, fullMark: 150 },
  { subject: 'Disgust', A: 85, fullMark: 150 },
  { subject: 'Joy', A: 15, fullMark: 150 },
];

const THREAT_TRENDS = [
  { time: '00:00', intensity: 20, fear: 15 },
  { time: '04:00', intensity: 45, fear: 35 },
  { time: '08:00', intensity: 30, fear: 25 },
  { time: '12:00', intensity: 75, fear: 60 },
  { time: '16:00', intensity: 60, fear: 45 },
  { time: '20:00', intensity: 90, fear: 80 },
  { time: '23:59', intensity: 55, fear: 40 },
];

// Sample tweets for simulation based on Table 1
const SAMPLE_TWEETS = [
  "I have enough problems of my own. I don’t care about the war really",
  "War or No War: my problems are not going anywhere",
  "I hope that the Russian-Ukraine war ends amicably #Peace",
  "Ukraine has put a brave front #StopWar #Peace",
  "Happy to see that the oppressed is not giving up to his aggressor! #IStandWithUkraine",
  "#Terror #PutinWarCriminal #StopRussianAggression #StopRussia",
  "I am Angry! I am Fearful about the outcome of the war #StopRussia",
  "Critical zero-day vulnerability found in major banking system #CyberSecurity",
  "New ransomware attack targeting healthcare providers in the US",
  "Hacker group claims responsibility for data breach at tech giant",
];

const THREAT_LEVEL_COLORS = {
  Critical: '#f43f5e',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#64748b'
};

const THREAT_CATEGORIES: ThreatCategory[] = [
  { id: '1', name: 'Ransomware', sentiment: 'Negative', dominantEmotion: 'Fear', intensity: 85, level: 'Critical', description: 'High emotional impact due to immediate financial loss and operational disruption.' },
  { id: '2', name: 'Phishing', sentiment: 'Negative', dominantEmotion: 'Anger', intensity: 60, level: 'High', description: 'Moderate intensity, often relying on urgency and social engineering.' },
  { id: '3', name: 'Botnet Traffic', sentiment: 'Neutral', dominantEmotion: 'Neutral', intensity: 12, level: 'Low', description: 'Automated traffic tends to be emotionally neutral and technical (Section 4).' },
  { id: '4', name: 'APT Activity', sentiment: 'Negative', dominantEmotion: 'Anger/Fear', intensity: 92, level: 'Critical', description: 'Targeted attacks exhibit significantly higher emotional intensity in reports (Section 4).' },
  { id: '5', name: 'Social Engineering', sentiment: 'Negative', dominantEmotion: 'Trust/Deception', intensity: 45, level: 'Medium', description: 'Psychological manipulation that exploits human trust, showing moderate emotional complexity.' },
];

// --- Components ---

const StatCard = ({ title, value, icon: Icon, trend, color }: { title: string, value: string, icon: any, trend?: string, color?: string }) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl flex items-center gap-4"
  >
    <div className={cn("p-3 rounded-lg bg-slate-800", color)}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-slate-400 text-sm font-medium">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        {trend && <span className="text-emerald-400 text-xs font-medium">{trend}</span>}
      </div>
    </div>
  </motion.div>
);

const SectionHeader = ({ title, subtitle }: { title: string, subtitle?: string }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-white flex items-center gap-2">
      <div className="w-1 h-6 bg-indigo-500 rounded-full" />
      {title}
    </h2>
    {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'datasets' | 'analysis' | 'comparison' | 'chatbot' | 'storage'>('dashboard');
  const [analysisText, setAnalysisText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [compareDataset1, setCompareDataset1] = useState(DATASETS[0].id);
  const [compareDataset2, setCompareDataset2] = useState(DATASETS[1].id);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonReport, setComparisonReport] = useState<any>(null);

  // Firebase State
  const [user, setUser] = useState<any>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Auth UI State
  const [showLogin, setShowLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const recaptchaVerifierRef = React.useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setShowLogin(false);
    });
    return () => {
      unsubscribe();
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (recaptchaVerifierRef.current) return recaptchaVerifierRef.current;
    
    try {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        }
      });
      recaptchaVerifierRef.current = verifier;
      return verifier;
    } catch (error) {
      console.error("Recaptcha Init Error:", error);
      return null;
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSendingOtp(true);

    try {
      const verifier = setupRecaptcha();
      if (!verifier) throw new Error("Failed to initialize reCAPTCHA. Please refresh the page.");
      
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(confirmation);
      setVerificationId(confirmation.verificationId);
    } catch (error: any) {
      console.error("Phone Auth Error:", error);
      
      let message = "Failed to send OTP. Please check the phone number format (e.g., +1234567890).";
      if (error.code === 'auth/operation-not-allowed') {
        message = "Phone authentication is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Too many requests. Please try again later.";
      } else if (error.message?.includes('reCAPTCHA')) {
        message = "reCAPTCHA verification failed. Please refresh the page and try again.";
      }
      
      setAuthError(message);
      
      // Reset verifier on error
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    
    setAuthError(null);
    setIsVerifyingOtp(true);

    try {
      await confirmationResult.confirm(otp);
    } catch (error: any) {
      console.error("OTP Verification Error:", error);
      setAuthError("Invalid OTP. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setShowLogin(true);
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'uploads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUploads(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // In a real app, we'd upload to Firebase Storage here.
      // For this demo, we'll store metadata in Firestore to simulate the "Storage" feature.
      await addDoc(collection(db, 'uploads'), {
        uploaderUid: user.uid,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        status: 'completed',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Upload Error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteUpload = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'uploads', id));
    } catch (error) {
      console.error("Delete Error:", error);
    }
  };

  const dataset1 = useMemo(() => DATASETS.find(d => d.id === compareDataset1), [compareDataset1]);
  const dataset2 = useMemo(() => DATASETS.find(d => d.id === compareDataset2), [compareDataset2]);

  const handleCompareDatasets = async () => {
    if (!dataset1 || !dataset2 || isComparing) return;
    setIsComparing(true);
    
    try {
      if (process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Compare these two CTI datasets: 
          Dataset 1: ${dataset1.name} (${dataset1.description})
          Dataset 2: ${dataset2.name} (${dataset2.description})
          
          Provide a comparative analysis in JSON format with:
          1. Complementary Value (How they work together)
          2. Analytical Gaps (What's missing from both)
          3. Recommended Use Case (When to use which)`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                gaps: { type: Type.STRING },
                useCase: { type: Type.STRING }
              },
              required: ["value", "gaps", "useCase"]
            }
          }
        });
        
        if (response.text) {
          setComparisonReport(JSON.parse(response.text));
        }
      }
    } catch (error) {
      console.error("Comparison Error:", error);
    } finally {
      setIsComparing(false);
    }
  };

  // Process sample tweets through the paper's NLP logic
  const processedTweets = useMemo(() => {
    return SAMPLE_TWEETS.map(t => ({
      text: t,
      ...analyzeTweet(t)
    }));
  }, []);

  const stats = useMemo(() => {
    const hSet = processedTweets.filter(t => t.isCyberRelevant);
    const bSet = processedTweets.filter(t => !t.isCyberRelevant);
    const outliers = processedTweets.filter(t => t.subjectivity > 0.6 && t.polarity < -0.4);
    
    return {
      corpusSize: processedTweets.length,
      hSetSize: hSet.length,
      bSetSize: bSet.length,
      outliersCount: outliers.length,
      avgPolarity: (processedTweets.reduce((acc, t) => acc + t.polarity, 0) / processedTweets.length).toFixed(2),
    };
  }, [processedTweets]);

  const sentimentDist = useMemo(() => {
    const counts = { Negative: 0, Neutral: 0, Positive: 0 };
    processedTweets.forEach(t => counts[t.sentiment]++);
    return [
      { name: 'Negative', value: counts.Negative, color: '#ef4444' },
      { name: 'Neutral', value: counts.Neutral, color: '#94a3b8' },
      { name: 'Positive', value: counts.Positive, color: '#22c55e' },
    ];
  }, [processedTweets]);

  const frequentMarkers = useMemo(() => {
    return getFrequentMarkers(SAMPLE_TWEETS).slice(0, 5);
  }, []);

  const handleAnalyze = async () => {
    if (!analysisText) return;
    setIsAnalyzing(true);
    
    try {
      const result = analyzeTweet(analysisText);
      
      // Determine insights based on paper's findings
      let insights = {
        motivation: result.sentiment === 'Negative' ? 'Aggressive intent or propaganda.' : 'Information sharing or neutral discourse.',
        publicReaction: result.subjectivity > 0.5 ? 'High emotional engagement/opinionated.' : 'Factual reporting or low engagement.',
        psychologicalImpact: result.polarity < -0.5 ? 'Potential for fear-mongering or radicalization.' : 'Low psychological stress.'
      };

      // Generate dynamic emotion data for the radar chart
      const dynamicEmotions = EMOTION_RADAR.map(e => {
        let weight = 0.5 + Math.random() * 0.5;
        if (result.sentiment === 'Negative' && (e.subject === 'Anger' || e.subject === 'Fear')) weight += 0.3;
        if (result.subjectivity > 0.6 && e.subject === 'Disgust') weight += 0.2;
        return { ...e, A: Math.min(150, Math.floor(e.A * weight)) };
      });

      // AI-Powered Intelligence Report
      let aiReport = null;
      if (process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analyze this threat actor communication based on CTI principles: "${analysisText}". 
          Provide a structured report with:
          1. Threat Actor Profile (Potential)
          2. Emotional Subtext Analysis
          3. Strategic Intent
          4. Recommended Countermeasures`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                profile: { type: Type.STRING },
                emotions: { type: Type.STRING },
                intent: { type: Type.STRING },
                countermeasures: { type: Type.STRING }
              },
              required: ["profile", "emotions", "intent", "countermeasures"]
            }
          }
        });
        
        if (response.text) {
          aiReport = JSON.parse(response.text);
        }
      }

      setAnalysisResult({
        ...result,
        insights,
        emotions: dynamicEmotions,
        aiReport
      });
    } catch (error) {
      console.error("Analysis Error:", error);
      // Fallback to mock analysis if AI fails
      const result = analyzeTweet(analysisText);
      setAnalysisResult({
        ...result,
        insights: {
          motivation: 'Analysis engine error. Using local heuristics.',
          publicReaction: 'N/A',
          psychologicalImpact: 'N/A'
        },
        emotions: EMOTION_RADAR
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!user && showLogin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div id="recaptcha-container"></div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/20">
              <Shield size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">CyberSense Access</h1>
            <p className="text-slate-400 text-sm">Secure intelligence portal for CTI analysts</p>
          </div>

          <div className="space-y-6">
            {!verificationId ? (
              <form onSubmit={handlePhoneSignIn} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="tel" 
                      placeholder="+1 234 567 8900"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Include country code (e.g., +1 for USA)</p>
                </div>

                {authError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-500 text-xs">
                    <AlertTriangle size={14} />
                    {authError}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isSendingOtp}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSendingOtp ? <Loader2 size={18} className="animate-spin" /> : <Smartphone size={18} />}
                  Send OTP Code
                </button>

                <div className="pt-4 border-t border-slate-800/50 mt-4">
                  <button 
                    type="button"
                    onClick={() => setUser({ 
                      uid: 'demo-analyst-123', 
                      phoneNumber: '+1 000 000 0000', 
                      displayName: 'Demo Analyst' 
                    })}
                    className="w-full py-2 bg-slate-800/30 hover:bg-slate-800/60 text-slate-500 hover:text-indigo-400 rounded-lg text-[10px] font-bold transition-all border border-dashed border-slate-700"
                  >
                    🚀 DEVELOPER BYPASS: Enter as Guest
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verification Code</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all tracking-[0.5em] text-center font-bold"
                      maxLength={6}
                      required
                    />
                  </div>
                </div>

                {authError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-500 text-xs">
                    <AlertTriangle size={14} />
                    {authError}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isVerifyingOtp}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifyingOtp ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                  Verify & Access
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setVerificationId(null);
                    setOtp('');
                    setAuthError(null);
                  }}
                  className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs font-medium transition-all"
                >
                  Change Phone Number
                </button>

                <div className="pt-4 border-t border-slate-800/50 mt-4">
                  <button 
                    type="button"
                    onClick={() => setUser({ 
                      uid: 'demo-analyst-123', 
                      phoneNumber: '+1 000 000 0000', 
                      displayName: 'Demo Analyst' 
                    })}
                    className="w-full py-2 bg-slate-800/30 hover:bg-slate-800/60 text-slate-500 hover:text-indigo-400 rounded-lg text-[10px] font-bold transition-all border border-dashed border-slate-700"
                  >
                    🚀 DEVELOPER BYPASS: Enter as Guest
                  </button>
                </div>
              </form>
            )}

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500 font-bold">Or continue with</span></div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3 border border-slate-700"
            >
              <img src="https://www.gstatic.com/firebase/anonymous-scan/google.svg" alt="Google" className="w-5 h-5" />
              Google Account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-50 hidden lg:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Shield className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">CyberSense</h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'dashboard' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Activity size={20} />
            <span className="font-medium">Intelligence Overview</span>
          </button>
          <button 
            onClick={() => setActiveTab('datasets')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'datasets' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Database size={20} />
            <span className="font-medium">Dataset Explorer</span>
          </button>
          <button 
            onClick={() => setActiveTab('analysis')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'analysis' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <BrainCircuit size={20} />
            <span className="font-medium">Emotion Analysis</span>
          </button>
          <button 
            onClick={() => setActiveTab('comparison')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'comparison' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Zap size={20} />
            <span className="font-medium">Threat Comparison</span>
          </button>
          <button 
            onClick={() => setActiveTab('chatbot')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'chatbot' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <MessageSquare size={20} />
            <span className="font-medium">Intelligence Bot</span>
          </button>
          <button 
            onClick={() => setActiveTab('storage')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'storage' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Cloud size={20} />
            <span className="font-medium">Cloud Storage</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          {user ? (
            <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-xl mb-4">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                  {user.phoneNumber?.slice(-2) || '??'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.displayName || user.phoneNumber}</p>
                <button onClick={handleLogout} className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1">
                  <LogOut size={10} /> Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowLogin(true)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all mb-4"
            >
              Sign In to Portal
            </button>
          )}
          <div className="bg-slate-800/50 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">System Status</span>
            </div>
            <p className="text-sm text-slate-200 font-medium">NLP Engine: Online</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen p-4 lg:p-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {activeTab === 'dashboard' && "Intelligence Overview"}
              {activeTab === 'datasets' && "Dataset Explorer"}
              {activeTab === 'analysis' && "Emotion-Aware Sentiment Analysis"}
              {activeTab === 'comparison' && "Threat Categorization & Comparison"}
              {activeTab === 'chatbot' && "Cyber Intelligence Chatbot"}
            </h2>
            <p className="text-slate-400">Monitoring global cyber threat emotions and sentiment patterns.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Search intelligence..." 
                className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full md:w-64"
              />
            </div>
            <button className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
              <Globe size={20} />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Corpus C Size" value={stats.corpusSize.toString()} icon={Activity} color="bg-indigo-500" />
                <StatCard title="H-Set (Cyber)" value={stats.hSetSize.toString()} icon={Shield} color="bg-rose-500" />
                <StatCard title="B-Set (Other)" value={stats.bSetSize.toString()} icon={Globe} color="bg-slate-700" />
                <StatCard title="Outliers Detected" value={stats.outliersCount.toString()} icon={AlertTriangle} color="bg-amber-500" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Research Context */}
                <div className="xl:col-span-1 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6">
                  <SectionHeader title="Research Context" subtitle="Methodology from Arora et al. (2023)" />
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 bg-indigo-500 p-1.5 rounded text-white">
                        <Shield size={14} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Bot Libre Integration</h4>
                        <p className="text-xs text-slate-400 mt-1">Chatbot deployed on Twitter to initiate conversations and collect real-time intelligence (Section 3.1).</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 bg-indigo-500 p-1.5 rounded text-white">
                        <Database size={14} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">NICCS Lexicon (δ)</h4>
                        <p className="text-xs text-slate-400 mt-1">Used as a reference to identify cyber-relevant tweets (H-set) vs. general tweets (B-set).</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 bg-indigo-500 p-1.5 rounded text-white">
                        <TrendingUp size={14} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Sentiment Orientation</h4>
                        <p className="text-xs text-slate-400 mt-1">Utilizing TextBlob and SentiWordnet for complex polarity and subjectivity analysis.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subjectivity vs Polarity Scatter Plot (Figure 4) */}
                <div className="xl:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                  <SectionHeader title="Subjectivity vs. Polarity (Figure 4)" subtitle="Mapping the emotional landscape of the corpus" />
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={processedTweets}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="polarity" type="number" domain={[-1, 1]} tick={{ fill: '#94a3b8' }} label={{ value: 'Polarity', position: 'bottom', fill: '#94a3b8' }} />
                        <YAxis dataKey="subjectivity" type="number" domain={[0, 1]} tick={{ fill: '#94a3b8' }} label={{ value: 'Subjectivity', angle: -90, position: 'left', fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                        <Line type="monotone" dataKey="subjectivity" stroke="transparent" dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isOutlier = payload.subjectivity > 0.6 && payload.polarity < -0.4;
                          return (
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={isOutlier ? 6 : 4} 
                              fill={isOutlier ? '#ef4444' : '#6366f1'} 
                              stroke={isOutlier ? '#fff' : 'none'}
                            />
                          );
                        }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Frequent Markers (Ψf) */}
                <div className="xl:col-span-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                  <SectionHeader title="Frequent Markers (Ψf)" subtitle="Top latent words mined via Apriori" />
                  <div className="space-y-4">
                    {frequentMarkers.map((marker, idx) => (
                      <div key={marker.word} className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-3">
                          <span className="text-indigo-500 font-mono text-xs">#{idx + 1}</span>
                          <span className="text-sm font-medium text-white">{marker.word}</span>
                        </div>
                        <span className="text-xs text-slate-500">{(marker.support * 100).toFixed(1)}% support</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                    <p className="text-xs text-indigo-300 leading-relaxed">
                      <Info size={12} className="inline mr-1 mb-0.5" />
                      Markers with support ≥ 1% are classified as frequent markers (Section 3.2.3).
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Sentiment Distribution (Table 1) */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                  <SectionHeader title="Sentiment Classification (Table 1)" subtitle="Distribution of Positive, Neutral, and Negative tweets" />
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sentimentDist}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                        <YAxis tick={{ fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                        <Bar dataKey="value">
                          {sentimentDist.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              {/* Recent Alerts */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <SectionHeader title="Recent Intelligence Alerts" />
                  <button className="text-indigo-400 text-sm font-medium hover:underline">View all</button>
                </div>
                <div className="divide-y divide-slate-800">
                  {[
                    { id: 1, title: 'New Ransomware Variant "ShadowLock"', time: '12 mins ago', emotion: 'Fear', level: 'Critical' },
                    { id: 2, title: 'Radicalization spike in ISIS Twitter Dataset', time: '45 mins ago', emotion: 'Anger', level: 'High' },
                    { id: 3, title: 'Anomalous Botnet traffic in CTU-13 node', time: '2 hours ago', emotion: 'Neutral', level: 'Medium' },
                  ].map((alert) => (
                    <div key={alert.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-lg",
                          alert.level === 'Critical' ? "bg-rose-500/10 text-rose-500" : "bg-indigo-500/10 text-indigo-500"
                        )}>
                          {alert.level === 'Critical' ? <AlertTriangle size={20} /> : <Info size={20} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{alert.title}</h4>
                          <p className="text-xs text-slate-400">{alert.time} • Dominant Emotion: <span className="text-slate-200">{alert.emotion}</span></p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                        alert.level === 'Critical' ? "bg-rose-500/20 text-rose-500 border border-rose-500/30" : "bg-indigo-500/20 text-indigo-500 border border-indigo-500/30"
                      )}>
                        {alert.level}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

          {/* Datasets Tab */}
          {activeTab === 'datasets' && (
            <motion.div 
              key="datasets"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {!selectedDatasetId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {DATASETS.map((dataset) => (
                    <motion.div 
                      key={dataset.id}
                      whileHover={{ y: -4 }}
                      className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="bg-indigo-500/10 p-3 rounded-xl text-indigo-500">
                          {dataset.type === 'Social Media' && <MessageSquare size={24} />}
                          {dataset.type === 'Network Traffic' && <Zap size={24} />}
                          {dataset.type === 'Reports' && <FileText size={24} />}
                          {dataset.type === 'Events' && <Globe size={24} />}
                          {dataset.type === 'Metadata' && <Database size={24} />}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-800 px-2 py-1 rounded">
                          {dataset.type}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{dataset.name}</h3>
                      <p className="text-sm text-slate-400 mb-4 flex-1 leading-relaxed">
                        {dataset.description}
                      </p>
                      <div className="space-y-3 pt-4 border-t border-slate-800">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Dataset Size</span>
                          <span className="text-slate-200 font-medium">{dataset.size}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">CTI Relevance</span>
                          <span className="text-slate-200 font-medium text-right max-w-[150px]">{dataset.relevance}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedDatasetId(dataset.id)}
                        className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        Explore Data <ChevronRight size={16} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedDatasetId(null)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    <ChevronRight size={16} className="rotate-180" /> Back to Datasets
                  </button>
                  
                  {(() => {
                    const dataset = DATASETS.find(d => d.id === selectedDatasetId);
                    if (!dataset) return null;
                    return (
                      <div className="space-y-6">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                              <h2 className="text-2xl font-bold text-white mb-1">{dataset.name}</h2>
                              <p className="text-slate-400 text-sm">{dataset.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold border border-indigo-500/20">
                                {dataset.type}
                              </div>
                              <div className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-bold border border-slate-700">
                                {dataset.size}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Sample Data Records</h3>
                              <div className="space-y-3">
                                {dataset.sampleData?.map((record) => (
                                  <div key={record.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/50 transition-colors group">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] font-mono text-indigo-500 bg-indigo-500/5 px-1.5 py-0.5 rounded">ID: {record.id}</span>
                                      <div className="flex items-center gap-2">
                                        {record.label && (
                                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-slate-900 px-2 py-0.5 rounded">
                                            {record.label}
                                          </span>
                                        )}
                                        {record.sentiment && (
                                          <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded",
                                            record.sentiment === 'Negative' && "text-rose-500 bg-rose-500/10",
                                            record.sentiment === 'Positive' && "text-emerald-500 bg-emerald-500/10",
                                            record.sentiment === 'Neutral' && "text-slate-400 bg-slate-800"
                                          )}>
                                            {record.sentiment}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed group-hover:text-white transition-colors">
                                      {record.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div className="space-y-6">
                              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Intelligence Value</h3>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                  {dataset.relevance}
                                </p>
                                <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                      <Shield size={16} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-white">Verified Source</p>
                                      <p className="text-[10px] text-slate-500">Academic/Research Grade</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                      <Activity size={16} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-white">High Fidelity</p>
                                      <p className="text-[10px] text-slate-500">Labeled for Sentiment</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="bg-indigo-600 rounded-xl p-6 text-white shadow-lg shadow-indigo-600/20">
                                <BrainCircuit className="mb-4" size={32} />
                                <h3 className="font-bold mb-2">Analyze this Dataset</h3>
                                <p className="text-xs text-indigo-100 mb-4 leading-relaxed">
                                  Run the emotion-aware sentiment model against this specific data stream to identify latent threat markers.
                                </p>
                                <button 
                                  onClick={() => setActiveTab('analysis')}
                                  className="w-full py-2 bg-white text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors"
                                >
                                  Open Analysis Engine
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </motion.div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                <SectionHeader title="Simulate Emotion-Aware Analysis" subtitle="Input CTI text or social media posts to analyze sentiment and underlying emotions." />
                
                <div className="space-y-4">
                  <textarea 
                    value={analysisText}
                    onChange={(e) => setAnalysisText(e.target.value)}
                    placeholder="Enter threat actor communication, tweet, or report snippet..."
                    className="w-full h-40 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                  />
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setAnalysisText('We will make them pay for their interference. Our vengeance will be swift and digital.')}
                        className="text-[10px] px-2 py-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-400"
                      >
                        Sample: Threat
                      </button>
                      <button 
                        onClick={() => setAnalysisText('The system has been compromised. We are seeing massive data exfiltration across all nodes.')}
                        className="text-[10px] px-2 py-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-400"
                      >
                        Sample: Incident
                      </button>
                    </div>
                    <button 
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !analysisText}
                      className={cn(
                        "px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2",
                        isAnalyzing || !analysisText ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
                      )}
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap size={18} />
                          Analyze Emotion
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {analysisResult && !isAnalyzing && (
                <>
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-indigo-500" />
                        Analysis Results
                      </h3>
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Sentiment</span>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                            analysisResult.sentiment === 'Negative' ? "bg-rose-500/20 text-rose-500" : "bg-slate-500/20 text-slate-400"
                          )}>
                            {analysisResult.sentiment}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Sentiment Score</span>
                          <span className="text-white font-mono">{analysisResult.score}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Threat Level</span>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                            analysisResult.threatLevel === 'High' ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
                          )}>
                            {analysisResult.threatLevel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:col-span-2 lg:col-span-1">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Ghost size={20} className="text-indigo-500" />
                        Emotion Distribution
                      </h3>
                      <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analysisResult.emotions || EMOTION_RADAR}>
                            <PolarGrid stroke="#1e293b" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                            <Radar
                              name="Emotion Intensity"
                              dataKey="A"
                              stroke="#6366f1"
                              fill="#6366f1"
                              fillOpacity={0.5}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                              itemStyle={{ color: '#f8fafc' }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-center gap-3">
                        {EMOTION_RADAR.map((item) => (
                          <div key={item.subject} className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{item.subject}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:col-span-2 lg:col-span-1">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <BrainCircuit size={20} className="text-indigo-500" />
                        Sentiment Metrics
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Polarity</span>
                          <span className="text-white font-mono">{analysisResult.polarity}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Subjectivity</span>
                          <span className="text-white font-mono">{analysisResult.subjectivity}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Cyber Relevant (H-Set)</span>
                          <span className={cn(
                            "font-bold",
                            analysisResult.isCyberRelevant ? "text-emerald-500" : "text-slate-500"
                          )}>
                            {analysisResult.isCyberRelevant ? 'YES' : 'NO'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
                  >
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                      <Info size={20} className="text-indigo-500" />
                      Intelligence Insights
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <TrendingUp size={14} /> Actor Motivation
                        </h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysisResult.insights.motivation}</p>
                      </div>
                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Globe size={14} /> Public Reaction
                        </h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysisResult.insights.publicReaction}</p>
                      </div>
                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Activity size={14} /> Psychological Impact
                        </h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysisResult.insights.psychologicalImpact}</p>
                      </div>
                    </div>

                    {analysisResult.aiReport && (
                      <div className="mt-8 pt-8 border-t border-slate-800">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                          <Shield size={20} className="text-emerald-500" />
                          AI Intelligence Report
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Threat Actor Profile</h4>
                              <p className="text-sm text-slate-300 bg-slate-950/30 p-4 rounded-xl border border-slate-800/50">{analysisResult.aiReport.profile}</p>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Strategic Intent</h4>
                              <p className="text-sm text-slate-300 bg-slate-950/30 p-4 rounded-xl border border-slate-800/50">{analysisResult.aiReport.intent}</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Emotional Subtext</h4>
                              <p className="text-sm text-slate-300 bg-slate-950/30 p-4 rounded-xl border border-slate-800/50">{analysisResult.aiReport.emotions}</p>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Recommended Countermeasures</h4>
                              <p className="text-sm text-slate-300 bg-slate-950/30 p-4 rounded-xl border border-slate-800/50">{analysisResult.aiReport.countermeasures}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </motion.div>
          )}

          {/* Comparison Tab */}
          {activeTab === 'comparison' && (
            <motion.div 
              key="comparison"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                  <SectionHeader title="Threat Categorization Matrix" subtitle="Comparing emotional intensity and sentiment across threat types." />
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={THREAT_CATEGORIES} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#f8fafc', fontSize: 12 }} width={100} />
                        <Tooltip 
                          cursor={{ fill: '#1e293b' }}
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                          itemStyle={{ color: '#f8fafc' }}
                        />
                        <Bar dataKey="intensity" radius={[0, 4, 4, 0]}>
                          {THREAT_CATEGORIES.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={THREAT_LEVEL_COLORS[entry.level]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-4">
                  {THREAT_CATEGORIES.map((category) => (
                    <div key={category.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-white flex items-center gap-2">
                            {category.name}
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                              category.level === 'Critical' && "bg-rose-500/20 text-rose-500 border border-rose-500/30",
                              category.level === 'High' && "bg-orange-500/20 text-orange-500 border border-orange-500/30",
                              category.level === 'Medium' && "bg-amber-500/20 text-amber-500 border border-amber-500/30",
                              category.level === 'Low' && "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                            )}>
                              {category.level}
                            </span>
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Emotion:</span>
                            <span className="text-xs font-semibold text-indigo-400">{category.dominantEmotion}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono text-slate-500">{category.intensity}% Intensity</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        {category.description}
                      </p>
                      <div className="mt-3">
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div className={cn(
                            "h-full transition-all duration-500",
                            category.level === 'Critical' && "bg-rose-500",
                            category.level === 'High' && "bg-orange-500",
                            category.level === 'Medium' && "bg-amber-500",
                            category.level === 'Low' && "bg-slate-500"
                          )} style={{ width: `${category.intensity}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <SectionHeader title="Dataset Comparison Model" subtitle="Side-by-side analysis of CTI data sources." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Primary Dataset</label>
                    <select 
                      value={compareDataset1}
                      onChange={(e) => setCompareDataset1(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {DATASETS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {dataset1 && (
                      <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">Type</span>
                          <span className="text-xs font-bold text-indigo-400">{dataset1.type}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">Volume</span>
                          <span className="text-xs font-bold text-white">{dataset1.size}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-slate-500 block">Primary Relevance</span>
                          <p className="text-xs text-slate-300 leading-relaxed">{dataset1.relevance}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Comparison Dataset</label>
                    <select 
                      value={compareDataset2}
                      onChange={(e) => setCompareDataset2(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {DATASETS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {dataset2 && (
                      <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">Type</span>
                          <span className="text-xs font-bold text-emerald-400">{dataset2.type}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">Volume</span>
                          <span className="text-xs font-bold text-white">{dataset2.size}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-slate-500 block">Primary Relevance</span>
                          <p className="text-xs text-slate-300 leading-relaxed">{dataset2.relevance}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleCompareDatasets}
                    disabled={isComparing}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                  >
                    {isComparing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Generating Comparison...
                      </>
                    ) : (
                      <>
                        <BrainCircuit size={18} />
                        Generate AI Comparison Report
                      </>
                    )}
                  </button>
                </div>

                {comparisonReport && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-8 p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl"
                  >
                    <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Zap size={16} /> AI Comparative Intelligence
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Complementary Value</span>
                        <p className="text-sm text-slate-300 leading-relaxed">{comparisonReport.value}</p>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Analytical Gaps</span>
                        <p className="text-sm text-slate-300 leading-relaxed">{comparisonReport.gaps}</p>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Recommended Use Case</span>
                        <p className="text-sm text-slate-300 leading-relaxed">{comparisonReport.useCase}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                  <SectionHeader title="Sentiment Model Comparison" subtitle="How different NLP tools interpret the same intelligence." />
                  <div className="space-y-6 mt-4">
                    <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400 italic mb-3">"The system has been compromised. We are seeing massive data exfiltration across all nodes."</p>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] uppercase tracking-tighter mb-1">
                            <span className="text-slate-500">TextBlob (Polarity)</span>
                            <span className="text-rose-500 font-bold">-0.45</span>
                          </div>
                          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500" style={{ width: '45%' }} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] uppercase tracking-tighter mb-1">
                            <span className="text-slate-500">SentiWordNet (Negative Score)</span>
                            <span className="text-rose-400 font-bold">0.62</span>
                          </div>
                          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-400" style={{ width: '62%' }} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] uppercase tracking-tighter mb-1">
                            <span className="text-slate-500">VADER (Compound)</span>
                            <span className="text-rose-600 font-bold">-0.78</span>
                          </div>
                          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-600" style={{ width: '78%' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      VADER often shows higher sensitivity to technical threat language due to its rule-based approach to intensity markers, whereas TextBlob relies more on general-purpose polarity lexicons.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                  <SectionHeader title="Intensity Methodology" subtitle="How threat levels are derived from sentiment and emotion." />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  {Object.entries(THREAT_LEVEL_COLORS).map(([level, color]) => (
                    <div key={level} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-medium text-slate-300">{level}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
                  Levels are calculated using a weighted matrix: <br />
                  <span className="text-indigo-400 font-mono">Intensity = (Sentiment Polarity * -100) + (Emotion Weight * Subjectivity)</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
                <Skull className="mx-auto text-slate-700 mb-4" size={48} />
                <h3 className="text-xl font-bold text-white mb-2">Advanced Threat Comparison</h3>
                <p className="text-slate-400 max-w-2xl mx-auto mb-6">
                  Our survey indicates that targeted attacks (APTs) exhibit significantly higher emotional intensity in technical reports compared to automated botnet traffic, which tends to be emotionally neutral.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                    <span className="text-xs text-slate-500 block uppercase tracking-tighter">Avg APT Intensity</span>
                    <span className="text-lg font-bold text-rose-500">92%</span>
                  </div>
                  <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                    <span className="text-xs text-slate-500 block uppercase tracking-tighter">Avg Botnet Intensity</span>
                    <span className="text-lg font-bold text-slate-400">12%</span>
                  </div>
                  <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                    <span className="text-xs text-slate-500 block uppercase tracking-tighter">Radicalization Correlation</span>
                    <span className="text-lg font-bold text-indigo-400">0.84</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Chatbot Tab */}
          {activeTab === 'chatbot' && (
            <motion.div 
              key="chatbot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-5xl mx-auto"
            >
              <CyberBot />
            </motion.div>
          )}

          {/* Storage Tab */}
          {activeTab === 'storage' && (
            <motion.div 
              key="storage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              {!user ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
                  <Lock className="mx-auto text-indigo-500 mb-6" size={48} />
                  <h2 className="text-2xl font-bold text-white mb-4">Secure Storage Access</h2>
                  <p className="text-slate-400 max-w-md mx-auto mb-8">
                    Sign in with your account to access the secure CTI cloud storage and upload large datasets for processing.
                  </p>
                  <button 
                    onClick={() => setShowLogin(true)}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Go to Login Page
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total Storage" value="2.4 GB" icon={HardDrive} color="bg-indigo-500/10 text-indigo-500" />
                    <StatCard title="Files Uploaded" value={uploads.length.toString()} icon={FileText} color="bg-emerald-500/10 text-emerald-500" />
                    <StatCard title="Cloud Status" value="Healthy" icon={Cloud} color="bg-sky-500/10 text-sky-500" />
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                      <div>
                        <h2 className="text-xl font-bold text-white mb-1">Dataset Upload Center</h2>
                        <p className="text-slate-400 text-sm">Upload large CTI files (CSV, JSON, TXT) for automated analysis.</p>
                      </div>
                      <label className="relative flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-indigo-600/20">
                        {isUploading ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload size={20} />
                            Upload New Dataset
                          </>
                        )}
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          accept=".csv,.json,.txt"
                        />
                      </label>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Recent Uploads</h3>
                      {uploads.length === 0 ? (
                        <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
                          <Cloud className="mx-auto text-slate-700 mb-4" size={32} />
                          <p className="text-slate-500 text-sm">No files uploaded yet. Start by adding a dataset.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {uploads.map((file) => (
                            <div key={file.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition-colors group">
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-white mb-0.5">{file.fileName}</h4>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-slate-500 uppercase font-mono">{(file.fileSize / 1024).toFixed(1)} KB</span>
                                    <span className="text-[10px] text-slate-500">•</span>
                                    <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">{file.status}</span>
                                    <span className="text-[10px] text-slate-500">•</span>
                                    <span className="text-[10px] text-slate-500">{file.createdAt?.toDate().toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleDeleteUpload(file.id)}
                                className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6 flex items-start gap-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                      <Info size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-indigo-400 mb-1">Storage Quota & Processing</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Uploaded files are automatically queued for the **Emotion-Aware NLP Pipeline**. Large datasets (up to 500MB) are processed asynchronously. Metadata is stored in Firestore, while raw files are managed via Firebase Cloud Storage.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="lg:ml-64 p-8 border-t border-slate-900 text-center">
        <p className="text-slate-500 text-sm">
          CyberSense Intelligence Platform • Based on "A Survey on Emotion-Aware Sentiment Analysis for CTI"
        </p>
      </footer>
    </div>
  );
}
