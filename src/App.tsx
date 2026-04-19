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
  Mail,
  Eye,
  EyeOff,
  FileText,
  ChevronRight,
  Info,
  TrendingUp,
  History,
  ShieldCheck,
  UserCheck,
  UserCircle,
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
  LogOut,
  Bell,
  Map,
  Users,
  Languages,
  Radio,
  Terminal,
  Share2,
  Download,
  MessageCircle,
  ThumbsUp,
  Clock,
  ExternalLink,
  Filter,
  RefreshCw
} from 'lucide-react';
import * as d3 from 'd3';
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
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
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
  { id: '6', name: 'Insider Threat', sentiment: 'Negative', dominantEmotion: 'Betrayal', intensity: 78, level: 'High', description: 'Internal actors cause high stress due to breached organizational trust.' },
  { id: '7', name: 'Supply Chain', sentiment: 'Neutral', dominantEmotion: 'Uncertainty', intensity: 88, level: 'Critical', description: 'Downstream effects from compromised vendors create massive sector-wide fear.' },
  { id: '8', name: 'DDoS Attack', sentiment: 'Negative', dominantEmotion: 'Frustration', intensity: 35, level: 'Medium', description: 'Service unavailability leads to high frustration but lower long-term fear.' },
];

// --- Components ---

const Sparkline = ({ data, color }: { data: number[], color: string }) => (
  <div className="h-10 w-24">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.map(v => ({ v }))}>
        <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const RiskGauge = ({ value }: { value: number }) => {
  const rotation = (value / 100) * 180 - 90;
  return (
    <div className="relative w-48 h-24 overflow-hidden mx-auto mt-4">
      <div className="absolute inset-0 border-[12px] border-slate-800 rounded-t-full" />
      <div 
        className="absolute inset-0 border-[12px] rounded-t-full border-t-indigo-500 border-r-indigo-500 transition-all duration-1000"
        style={{ 
          borderColor: value > 75 ? '#ef4444' : value > 40 ? '#f59e0b' : '#10b981',
          clipPath: `inset(0 0 0 ${100 - (value / 2)}%)`,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'bottom center'
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 text-center">
        <span className="text-3xl font-black text-white">{value}</span>
        <span className="text-[10px] text-slate-500 uppercase block font-bold">Threat Index</span>
      </div>
    </div>
  );
};

const LiveActivityFeed = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let intervalId: any;

    const fetchRealWorldIntel = async () => {
      try {
        if (!process.env.GEMINI_API_KEY) {
          setActivities([
            { id: 1, type: 'MISP-IOC', msg: 'Anomalous traffic detected on Node-14', time: '12s ago', level: 'HIGH' },
            { id: 2, type: 'THREAT-INTEL', msg: 'New CTI report ingested from external source', time: '45s ago', level: 'INFO' },
            { id: 3, type: 'CVE-ALERT', msg: 'Ransomware keyword triggered on Alert Rule #2', time: '1m ago', level: 'CRITICAL' },
          ]);
          setIsLoading(false);
          return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Use your Google Search capabilities to find the latest real-world cyber threat intelligence alerts, new vulnerabilities (CVEs), ransomware activity, or malware campaigns reported in the news over the last 24-48 hours. 
          Extract 5 distinct recent threat indicators. Format the output to mirror a live MISP / ThreatConnect API response feed.
          Return a JSON array of objects with these exact fields:
          - id: unique number
          - type: strictly one of "MISP-IOC", "CVE-ALERT", "THREAT-INTEL", "APT-ACTIVITY"
          - msg: A concise, impactful description of the threat (max 60 chars)
          - time: generic string like "Just now" or "2m ago"
          - level: strictly one of "CRITICAL", "HIGH", "INFO"`,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  type: { type: Type.STRING },
                  msg: { type: Type.STRING },
                  time: { type: Type.STRING },
                  level: { type: Type.STRING }
                },
                required: ["id", "type", "msg", "time", "level"]
              }
            }
          }
        });

        if (response.text) {
          const intel = JSON.parse(response.text);
          if (Array.isArray(intel) && intel.length > 0) {
            setActivities(intel);
          }
        }
      } catch (error) {
        console.error("Live Intel Fetch Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRealWorldIntel();
    
    // Poll for new live intelligence every 60 seconds
    intervalId = setInterval(fetchRealWorldIntel, 60000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="space-y-3 relative">
      {isLoading && activities.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800">
          <RefreshCw className="text-indigo-500 animate-spin mb-2" size={24} />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing MISP Data...</span>
        </div>
      )}
      
      {activities.map(act => (
        <motion.div 
          key={act.id} 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 p-3 bg-slate-950/50 border border-slate-800 rounded-xl hover:bg-slate-900 transition-colors"
        >
          <div className={cn(
            "w-2 h-2 rounded-full shadow-[0_0_8px]",
            act.level === 'CRITICAL' ? "bg-rose-500 shadow-rose-500/80" : 
            act.level === 'HIGH' ? "bg-amber-500 shadow-amber-500/80" : "bg-indigo-500 shadow-indigo-500/80"
          )} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{act.type}</span>
              <span className="text-[9px] text-slate-600 font-mono">{act.time}</span>
            </div>
            <p className="text-xs text-slate-300 font-medium truncate">{act.msg}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, trend, color, sparkData }: { title: string, value: string, icon: any, trend?: string, color?: string, sparkData?: number[] }) => (
  <motion.div 
    whileHover={{ y: -2, scale: 1.02 }}
    className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex items-center justify-between gap-4 group transition-all hover:bg-slate-800/80 hover:border-slate-700 shadow-lg shadow-black/20"
  >
    <div className="flex items-center gap-4">
      <div className={cn("p-3 rounded-xl bg-slate-800 transition-colors group-hover:bg-slate-700", color)}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold text-white tracking-tighter">{value}</h3>
          {trend && (
            <div className={cn("flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded", trend.startsWith('+') ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10")}>
              {trend.startsWith('+') ? <TrendingUp size={10} className="mr-1" /> : <TrendingUp size={10} className="mr-1 rotate-180" />}
              {trend}
            </div>
          )}
        </div>
      </div>
    </div>
    {sparkData && <Sparkline data={sparkData} color={color?.split(' ')[1] === 'text-rose-500' ? '#ef4444' : color?.split(' ')[1] === 'text-amber-500' ? '#f59e0b' : '#6366f1'} />}
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

// --- Global Heatmap Component ---
const GlobalHeatmap = () => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [hotspots, setHotspots] = useState([
    { lat: 40.7128, lng: -74.0060, intensity: 85, emotion: 'Anger', location: 'New York, USA', threatType: 'Financial Sector Ransomware', source: 'DarkNet Monitor' },
    { lat: 55.7558, lng: 37.6173, intensity: 92, emotion: 'Fear', location: 'Moscow, Russia', threatType: 'APT Activity (CozyBear)', source: 'FSB Sourced Leak' },
    { lat: 39.9042, lng: 116.4074, intensity: 78, emotion: 'Disgust', location: 'Beijing, China', threatType: 'Industrial Espionage', source: 'CrowdStrike Intelligence' },
    { lat: 51.5074, lng: -0.1278, intensity: 45, emotion: 'Surprise', location: 'London, UK', threatType: '0-day Vulnerability Scan', source: 'ShadowServer' },
    { lat: -33.8688, lng: 151.2093, intensity: 30, emotion: 'Joy', location: 'Sydney, Australia', threatType: 'White Hat Disclosure', source: 'BugCrowd' },
    { lat: 28.6139, lng: 77.2090, intensity: 65, emotion: 'Fear', location: 'New Delhi, India', threatType: 'Banking Trojan Propagation', source: 'SecureWorks' },
  ]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 450;
    
    svg.selectAll("*").remove();

    const projection = d3.geoNaturalEarth1()
      .scale(150)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const tooltip = d3.select(tooltipRef.current);

    // Draw map (simplified)
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then((data: any) => {
      svg.append("g")
        .selectAll("path")
        .data(data.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#1e293b")
        .attr("stroke", "#334155")
        .attr("stroke-width", 0.5);

      // Add hotspots
      svg.append("g")
        .selectAll("circle")
        .data(hotspots)
        .enter()
        .append("circle")
        .attr("cx", (d: any) => projection([d.lng, d.lat])![0])
        .attr("cy", (d: any) => projection([d.lng, d.lat])![1])
        .attr("r", (d: any) => d.intensity / 10)
        .attr("fill", (d: any) => {
          // Color scale: Green (0) -> Amber (50) -> Red (100)
          if (d.intensity < 40) return "#22c55e";
          if (d.intensity < 75) return "#f59e0b";
          return "#ef4444";
        })
        .attr("fill-opacity", 0.6)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseover", (event: any, d: any) => {
          d3.select(event.currentTarget)
            .attr("fill-opacity", 0.9)
            .attr("r", (d.intensity / 10) * 1.2);
          
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip.html(`
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl min-w-[220px]">
              <div className="flex justify-between items-start mb-3 border-b border-slate-800 pb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">${d.location}</span>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">Intensity</span>
                  <span className="${d.intensity > 75 ? 'text-rose-500' : d.intensity > 40 ? 'text-amber-500' : 'text-emerald-500'} text-xl font-black font-mono leading-none">${d.intensity}%</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[8px] text-slate-500 uppercase font-black tracking-tighter mb-0.5">Primary Threat</p>
                  <p className="text-xs text-white font-bold leading-tight">${d.threatType}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">Intel Source</p>
                    <p className="text-[10px] text-indigo-300 font-medium truncate">${d.source}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">Emotion State</p>
                    <p className="text-[10px] text-slate-200 font-bold">${d.emotion}</p>
                  </div>
                </div>
              </div>
            </div>
          `)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", (event: any) => {
          tooltip
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", (event: any, d: any) => {
          d3.select(event.currentTarget)
            .attr("fill-opacity", 0.6)
            .attr("r", d.intensity / 10);
          
          tooltip.transition().duration(500).style("opacity", 0);
        });
    });
  }, [hotspots]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden relative">
      <div ref={tooltipRef} className="fixed pointer-events-none opacity-0 z-[100] transition-opacity duration-200" />
      <div className="flex justify-between items-center mb-6">
        <SectionHeader title="Global Threat Intensity Heatmap" subtitle="Geographic distribution of cyber threat pressure levels." />
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">High (75%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Med (40-75%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Low (&lt;40%)</span>
          </div>
        </div>
      </div>
      <div className="relative aspect-video w-full group">
        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
        <svg ref={svgRef} viewBox="0 0 800 450" className="w-full h-full" />
      </div>
    </div>
  );
};

// --- Live Feed Component ---
const LiveFeed = () => {
  const [feeds, setFeeds] = useState([
    { id: 1, source: 'AlienVault OTX', title: 'New Ransomware Variant: LockBit 4.0', time: '2 mins ago', emotion: 'Fear', intensity: 88, link: '#' },
    { id: 2, source: 'Krebs on Security', title: 'Data Breach at Major Retailer', time: '15 mins ago', emotion: 'Anger', intensity: 72, link: '#' },
    { id: 3, source: 'Threatpost', title: 'Zero-day in Chrome Patched', time: '1 hour ago', emotion: 'Surprise', intensity: 45, link: '#' },
    { id: 4, source: 'DarkReading', title: 'Phishing Campaign Targeting HR', time: '3 hours ago', emotion: 'Disgust', intensity: 58, link: '#' },
  ]);

  const handleLoadMore = () => {
    const newItems = [
      { id: feeds.length + 1, source: 'BleepingComputer', title: 'New Botnet "Mirai-X" spreading via IoT', time: 'Just now', emotion: 'Surprise', intensity: 65, link: '#' },
      { id: feeds.length + 2, source: 'SANS ISC', title: 'Anomalous traffic on port 445', time: 'Just now', emotion: 'Neutral', intensity: 30, link: '#' },
    ];
    setFeeds([...newItems, ...feeds]);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <SectionHeader title="Real-Time Intelligence Feed" subtitle="Live stream of cyber threats with emotional impact analysis." />
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
        <AnimatePresence>
          {feeds.map(feed => (
            <motion.div 
              key={feed.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-indigo-500/50 transition-all cursor-pointer group mb-4"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  feed.emotion === 'Fear' ? "bg-orange-500/10 text-orange-500" : 
                  feed.emotion === 'Anger' ? "bg-rose-500/10 text-rose-500" : "bg-indigo-500/10 text-indigo-500"
                )}>
                  <Radio size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{feed.source}</span>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className="text-[10px] text-slate-500">{feed.time}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{feed.title}</h4>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Emotion</div>
                  <div className={cn(
                    "text-xs font-bold",
                    feed.emotion === 'Fear' ? "text-orange-500" : 
                    feed.emotion === 'Anger' ? "text-rose-500" : "text-indigo-400"
                  )}>{feed.emotion} ({feed.intensity}%)</div>
                </div>
                <ChevronRight size={18} className="text-slate-700 group-hover:text-indigo-500 transition-all" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <button 
        onClick={handleLoadMore}
        className="w-full mt-6 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 border-dashed"
      >
        Load More Intelligence
      </button>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'datasets' | 'analysis' | 'comparison' | 'chatbot' | 'storage' | 'heatmap' | 'alerts' | 'collaboration' | 'darkweb'>('dashboard');
  const [analysisText, setAnalysisText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [compareDataset1, setCompareDataset1] = useState(DATASETS[0].id);
  const [compareDataset2, setCompareDataset2] = useState(DATASETS[1].id);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonReport, setComparisonReport] = useState<any>(null);
  
  // New Features State
  const [alerts, setAlerts] = useState<any[]>([
    { id: 1, name: 'Critical Aggression', type: 'intensity', category: 'Anger', threshold: 130, active: true, lastTriggered: '2026-04-16 14:22' },
    { id: 2, name: 'Ransomware Keyword', type: 'keyword', value: 'ransomware', active: true, lastTriggered: 'Never' },
    { id: 3, name: 'APT Threat Detection', type: 'threatType', value: 'APT Activity', active: true, lastTriggered: 'Never' },
    { id: 4, name: 'High Panic State', type: 'emotion', category: 'Fear', threshold: 120, active: true, lastTriggered: 'Never' },
  ]);
  const [comments, setComments] = useState<any[]>([
    { id: 1, author: 'Analyst_Alpha', avatar: 'A', content: 'The emotional subtext in the recent ShadowLock leak suggests a state-sponsored actor rather than a typical criminal group.', time: '2 hours ago', upvotes: 12, comments: 4 },
    { id: 2, author: 'CTI_Expert', avatar: 'C', content: 'Agreed. The lack of "Joy" or "Excitement" in their manifestos points to a more professional, strategic intent.', time: '5 hours ago', upvotes: 8, comments: 2 },
  ]);
  const [newComment, setNewComment] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [triggeredAlerts, setTriggeredAlerts] = useState<any[]>([
    { id: 1, type: 'Aggression', value: 85, timestamp: '2026-04-14 10:30', source: 'Internal Analysis', info: 'Critical aggression threshold exceeded in ransom post segment.' },
    { id: 2, type: 'Fear', value: 78, timestamp: '2026-04-14 09:15', source: 'ISIS-Twitter Monitor', info: 'Unusual spike in fear-based propaganda detected.' },
  ]);
  const [trendingTopics, setTrendingTopics] = useState<any[]>([
    { id: 1, topic: '#LockBit4', volume: 'High', sentiment: 'Negative' },
    { id: 2, topic: 'Zero-Day Chrome', volume: 'Medium', sentiment: 'Neutral' },
    { id: 3, topic: 'Bank Logs Leak', volume: 'Critical', sentiment: 'Aggressive' },
  ]);
  const [forumContext, setForumContext] = useState('General Underground');

  // Firebase State
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'guest' | null>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Auth UI State
  const [showLogin, setShowLogin] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        // Simple Admin Check: If the email matches the developer's or specific pattern
        const isAdmin = u.email === 'devanshmittal080@gmail.com' || u.email?.includes('admin');
        setUserRole(isAdmin ? 'admin' : 'guest');
        setShowLogin(false);
      } else {
        setUser(null);
        if (!userRole) setUserRole(null);
      }
    });
    return () => unsubscribe();
  }, [userRole]);

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
    setUserRole(null);
    setShowLogin(true);
  };

  const handleGuestLogin = () => {
    setUser({
      uid: 'guest-' + Math.random().toString(36).substr(2, 9),
      displayName: 'Guest Analyst',
      isAnonymous: true
    });
    setUserRole('guest');
    setShowLogin(false);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: email.split('@')[0]
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      setAuthError(error.message);
    } finally {
      setIsAuthLoading(false);
    }
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

  // Process sample tweets through the NLP logic (falls back to local logic if AI takes time or is unavailable)
  const [processedTweets, setProcessedTweets] = useState<any[]>(() => {
    return SAMPLE_TWEETS.map(t => ({
      text: t,
      ...analyzeTweet(t)
    }));
  });

  useEffect(() => {
    const fetchRealAIsentiment = async () => {
      if (!process.env.GEMINI_API_KEY) return;
      
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `You are an expert NLP sentiment analysis model. Analyze the following texts and provide exact statistical NLP metrics.
          For each text, provide:
          - polarity: float between -1.0 (highly negative) and 1.0 (highly positive)
          - subjectivity: float between 0.0 (very objective) and 1.0 (very subjective)
          - sentiment: strictly "Positive", "Neutral", or "Negative"
          - isCyberRelevant: boolean indicating if it's related to cybersecurity threats/events
          - frequentMarkers: array of up to 3 important contextual keywords (strings)
          
          Texts to analyze:
          ${JSON.stringify(SAMPLE_TWEETS)}
          `,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  polarity: { type: Type.NUMBER },
                  subjectivity: { type: Type.NUMBER },
                  sentiment: { type: Type.STRING },
                  isCyberRelevant: { type: Type.BOOLEAN },
                  frequentMarkers: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["polarity", "subjectivity", "sentiment", "isCyberRelevant", "frequentMarkers"]
              }
            }
          }
        });

        if (response.text) {
          const aiResults = JSON.parse(response.text);
          if (Array.isArray(aiResults) && aiResults.length === SAMPLE_TWEETS.length) {
            // Combine AI stats with original texts to update dashboard
            setProcessedTweets(SAMPLE_TWEETS.map((text, i) => ({
              text,
              ...aiResults[i]
            })));
          }
        }
      } catch (error) {
        console.error("Bulk AI NLP Analysis Error:", error);
      }
    };

    fetchRealAIsentiment();
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
      let textToAnalyze = analysisText;

      // Multi-Language Support: Translate if not English
      if (targetLanguage !== 'en' && process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const translationResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Translate the following text to English for CTI analysis. Maintain the original tone and emotional subtext: "${analysisText}"`,
        });
        if (translationResponse.text) {
          textToAnalyze = translationResponse.text;
        }
      }

      // AI-Powered Intelligence Report & NLP Sentiment Analysis
      let aiReport = null;
      let realNLPResult = null;
      if (process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analyze this threat actor communication based on CTI principles, NLP sentiment, and underground forum slang: "${textToAnalyze}". 
          Provide a highly granular structured report in JSON format with two main sections:
          1. nlpMetrics: Deep NLP analysis including polarity (-1 to 1), subjectivity (0 to 1), dominant sentiment ("Positive", "Neutral", "Negative"), cyberRelevance (boolean), and key cyber markers (array of strings).
          2. intelligenceReport: Specifically containing threatActorProfile (sophistication, motivation, potentialAffiliation), emotionalSubtext (string), strategicIntent (shortTermGoal, longTermObjective), countermeasures (immediateAction, longTermPrevention), and slangDecoded.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                nlpMetrics: {
                  type: Type.OBJECT,
                  properties: {
                    polarity: { type: Type.NUMBER },
                    subjectivity: { type: Type.NUMBER },
                    sentiment: { type: Type.STRING },
                    isCyberRelevant: { type: Type.BOOLEAN },
                    frequentMarkers: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["polarity", "subjectivity", "sentiment", "isCyberRelevant", "frequentMarkers"]
                },
                intelligenceReport: {
                  type: Type.OBJECT,
                  properties: {
                    threatActorProfile: {
                      type: Type.OBJECT,
                      properties: {
                        sophistication: { type: Type.STRING },
                        motivation: { type: Type.STRING },
                        potentialAffiliation: { type: Type.STRING }
                      },
                      required: ["sophistication", "motivation"]
                    },
                    emotionalSubtext: { type: Type.STRING },
                    strategicIntent: {
                      type: Type.OBJECT,
                      properties: {
                        shortTermGoal: { type: Type.STRING },
                        longTermObjective: { type: Type.STRING }
                      },
                      required: ["shortTermGoal", "longTermObjective"]
                    },
                    countermeasures: {
                      type: Type.OBJECT,
                      properties: {
                        immediateAction: { type: Type.STRING },
                        longTermPrevention: { type: Type.STRING }
                      },
                      required: ["immediateAction", "longTermPrevention"]
                    },
                    slangDecoded: { type: Type.STRING }
                  },
                  required: ["threatActorProfile", "emotionalSubtext", "strategicIntent", "countermeasures"]
                }
              },
              required: ["nlpMetrics", "intelligenceReport"]
            }
          }
        });
        
        if (response.text) {
          const parsed = JSON.parse(response.text);
          realNLPResult = parsed.nlpMetrics;
          aiReport = parsed.intelligenceReport;
        }
      }

      // Use real AI NLP if available, otherwise fallback to lexicon
      const result = realNLPResult || analyzeTweet(textToAnalyze);
      
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

      // Calculate high-level metrics for alert evaluation
      const dominantEmotion = [...dynamicEmotions].sort((a, b) => b.A - a.A)[0].subject;
      const overallIntensity = Math.min(100, Math.max(0, Math.floor((result.polarity * -50) + (result.subjectivity * 50))));

      // Update analysis result with derived metrics
      const enrichedResult = {
        ...result,
        dominantEmotion,
        intensity: overallIntensity
      };

      setAnalysisResult({
        ...enrichedResult,
        insights,
        emotions: dynamicEmotions,
        aiReport,
        originalText: analysisText,
        translatedText: textToAnalyze !== analysisText ? textToAnalyze : null
      });

      // Automated Alert System: Iterate through configured alert rules
      alerts.forEach(rule => {
        if (!rule.active) return;
        
        let triggered = false;
        let triggerValue = 0;
        let triggerInfo = '';

        if (rule.type === 'intensity') {
          const level = dynamicEmotions.find(e => e.subject === rule.category)?.A || 0;
          if (level >= rule.threshold) {
            triggered = true;
            triggerValue = Math.floor((level / 150) * 100);
            triggerInfo = `High ${rule.category} level (${level}) exceeded threshold of ${rule.threshold}.`;
          }
        } else if (rule.type === 'keyword') {
          if (textToAnalyze.toLowerCase().includes(rule.value.toLowerCase())) {
            triggered = true;
            triggerValue = 100;
            triggerInfo = `Keyword match detected: "${rule.value}" in communication pattern.`;
          }
        } else if (rule.type === 'emotion') {
          if (dominantEmotion === rule.category) {
            triggered = true;
            triggerValue = overallIntensity;
            triggerInfo = `Dominant emotion "${rule.category}" matches alert criteria.`;
          }
        } else if (rule.type === 'threatType') {
          // Check if any threat category name matches the rule value
          const matchingCategory = THREAT_CATEGORIES.find(c => c.name.toLowerCase().includes(rule.value.toLowerCase()));
          if (matchingCategory && enrichedResult.isCyberRelevant) {
            triggered = true;
            triggerValue = matchingCategory.intensity;
            triggerInfo = `Threat type alert: "${rule.value}" detected in relevant intelligence stream.`;
          }
        }

        if (triggered) {
          const newTriggeredAlert = {
            id: Date.now() + Math.random(),
            type: rule.name,
            value: triggerValue,
            timestamp: new Date().toLocaleString(),
            source: 'Dynamic Logic Engine',
            info: triggerInfo
          };
          setTriggeredAlerts(prev => [newTriggeredAlert, ...prev]);
          
          // Update lastTriggered in the main alerts list
          setAlerts(prev => prev.map(a => a.id === rule.id ? { ...a, lastTriggered: new Date().toLocaleString() } : a));
        }
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

  const handleExportReport = () => {
    if (!analysisResult) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `CyberSense_Analysis_Report_${timestamp}.txt`;

    let reportContent = `CYBERSENSE INTELLIGENCE ANALYSIS REPORT
==========================================
Generated on: ${new Date().toLocaleString()}
Source Text: "${analysisText}"

1. SENTIMENT ANALYSIS
---------------------
Overall Sentiment: ${analysisResult.sentiment}
Polarity Score: ${analysisResult.polarity}
Subjectivity Score: ${analysisResult.subjectivity}
Cyber Relevance: ${analysisResult.isCyberRelevant ? 'YES' : 'NO'}

2. EMOTION DISTRIBUTION
-----------------------
${analysisResult.emotions.map((e: any) => `${e.subject}: ${e.A}`).join('\n')}

3. INTELLIGENCE INSIGHTS
------------------------
Actor Motivation: ${analysisResult.insights.motivation}
Public Reaction: ${analysisResult.insights.publicReaction}
Psychological Impact: ${analysisResult.insights.psychologicalImpact}

`;

    if (analysisResult.aiReport) {
      reportContent += `4. AI INTELLIGENCE REPORT
-------------------------
Threat Actor Profile:
${analysisResult.aiReport.profile}

Strategic Intent:
${analysisResult.aiReport.intent}

Emotional Subtext:
${analysisResult.aiReport.emotions}

Recommended Countermeasures:
${analysisResult.aiReport.countermeasures}
`;
    }

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddAlert = () => {
    const newAlert = {
      id: Date.now(),
      name: `New Rule ${alerts.length + 1}`,
      type: 'intensity',
      category: 'Anger',
      threshold: 80,
      active: true,
      lastTriggered: 'Never'
    };
    setAlerts([...alerts, newAlert]);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const comment = {
      id: comments.length + 1,
      author: user?.displayName || 'Guest Analyst',
      avatar: (user?.displayName || 'G')[0],
      content: newComment,
      time: 'Just now',
      upvotes: 0,
      comments: 0
    };
    setComments([comment, ...comments]);
    setNewComment('');
  };

  const handleExportSTIX = () => {
    if (!analysisResult) return;

    const stixReport = {
      type: "bundle",
      id: `bundle--${crypto.randomUUID()}`,
      objects: [
        {
          type: "indicator",
          id: `indicator--${crypto.randomUUID()}`,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          name: "CyberSense Emotional Indicator",
          description: `Analysis of: ${analysisText}`,
          indicator_types: ["malicious-activity"],
          pattern: "[file:name = 'CTI_Analysis']",
          pattern_type: "stix",
          valid_from: new Date().toISOString(),
          external_references: [
            {
              source_name: "CyberSense",
              description: "Emotion-aware CTI analysis",
              url: "https://cybersense.ai"
            }
          ],
          custom_properties: {
            x_cybersense_sentiment: analysisResult.sentiment,
            x_cybersense_polarity: analysisResult.polarity,
            x_cybersense_emotions: analysisResult.emotions
          }
        }
      ]
    };

    const blob = new Blob([JSON.stringify(stixReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CyberSense_STIX_Report_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!user && showLogin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Atmospheric Background */}
        <div className="absolute inset-0 z-0 h-full w-full">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="absolute inset-0 bg-indigo-500/5 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
          <motion.div 
            initial={{ top: '-10%' }}
            animate={{ top: '110%' }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-[2px] bg-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.5)] z-10"
          />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md relative z-20"
        >
          <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-indigo-500/40 rounded-tl-lg" />
          <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-indigo-500/40 rounded-tr-lg" />
          <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-indigo-500/40 rounded-bl-lg" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-indigo-500/40 rounded-br-lg" />

          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="text-center mb-8">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 bg-indigo-600/10 border-2 border-indigo-500/30 rounded-full flex items-center justify-center mx-auto mb-4 relative"
              >
                <Shield size={28} className="text-indigo-400" />
              </motion.div>
              <h1 className="text-2xl font-black text-white tracking-tight italic font-serif">CyberSense</h1>
              <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">Intelligence Division</p>
            </div>

            <div className="flex gap-2 p-1 bg-slate-950 rounded-xl mb-6 border border-slate-800">
              <button 
                onClick={() => setAuthMode('google')}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                  authMode === 'google' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <Globe size={14} /> Google
              </button>
              <button 
                onClick={() => setAuthMode('email')}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                  authMode === 'email' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <Mail size={14} /> Email
              </button>
            </div>

            <AnimatePresence mode="wait">
              {authMode === 'google' ? (
                <motion.div
                  key="google-mode"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <button 
                    onClick={handleGoogleLogin}
                    className="w-full py-4 bg-white hover:bg-slate-100 text-slate-950 rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-xl group overflow-hidden relative"
                  >
                    <img src="https://www.gstatic.com/firebase/anonymous-scan/google.svg" alt="Google" className="w-5 h-5 relative z-10" />
                    <span className="relative z-10 text-xs uppercase">Unlock with Security Key</span>
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="email-mode"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <form onSubmit={handleEmailAuth} className="space-y-3">
                    <div className="relative">
                      <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Analytical ID (Email)" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        required
                      />
                    </div>
                    <div className="relative">
                      <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Security Token (Password)" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-12 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button 
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
                    >
                      {isAuthLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                      <span className="text-xs uppercase">{isSignUp ? 'Register Credential' : 'Verifying Session'}</span>
                    </button>
                  </form>
                  <div className="text-center">
                    <button 
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-[10px] text-slate-500 hover:text-indigo-400 uppercase font-bold tracking-widest"
                    >
                      {isSignUp ? 'Already registered? Log in' : 'Request new analyst credential'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative py-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
              <div className="relative flex justify-center text-[8px] uppercase font-bold tracking-widest">
                <span className="bg-slate-900 px-4 text-slate-600">Quick Access Modes</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => {
                  setUser({ uid: 'admin-demo', displayName: 'System Admin' });
                  setUserRole('admin');
                  setShowLogin(false);
                }}
                className="py-3 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl font-bold transition-all flex flex-col items-center justify-center gap-1 group"
              >
                <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] uppercase tracking-tighter">Admin mode</span>
              </button>
              
              <button 
                type="button"
                onClick={handleGuestLogin}
                className="py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-500 hover:text-white rounded-xl font-bold transition-all flex flex-col items-center justify-center gap-1 group"
              >
                <UserCircle size={20} className="group-hover:scale-110 transition-transform text-slate-600 group-hover:text-indigo-400" />
                <span className="text-[10px] uppercase tracking-tighter">Guest mode</span>
              </button>
            </div>

            {authError && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-[10px] font-mono text-center">
                SECURITY_ERROR: {authError}
              </div>
            )}

            <div className="mt-8 flex justify-center gap-4 border-t border-slate-800 pt-6">
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-slate-600 uppercase font-bold">API</span>
                <span className="text-[10px] text-emerald-500 font-mono">200 OK</span>
              </div>
              <div className="w-[1px] h-6 bg-slate-800" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-slate-600 uppercase font-bold">SSL</span>
                <span className="text-[10px] text-indigo-400 font-mono">TLS 1.3</span>
              </div>
            </div>
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

          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Advanced Intelligence</p>
          </div>

          <button 
            onClick={() => setActiveTab('heatmap')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'heatmap' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Map size={20} />
            <span className="font-medium">Global Heatmap</span>
          </button>
          <button 
            onClick={() => setActiveTab('alerts')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'alerts' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Bell size={20} />
            <span className="font-medium">Alert System</span>
          </button>
          <button 
            onClick={() => setActiveTab('collaboration')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'collaboration' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Users size={20} />
            <span className="font-medium">Collaboration</span>
          </button>
          <button 
            onClick={() => setActiveTab('darkweb')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
              activeTab === 'darkweb' ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Terminal size={20} />
            <span className="font-medium">Dark Web Simulator</span>
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
            <div className="p-3 bg-slate-800/50 rounded-xl mb-4 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-indigo-500/50" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-indigo-600/20">
                    {user.displayName?.charAt(0) || 'A'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{user.displayName || 'Analyst'}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest leading-none",
                      userRole === 'admin' ? "bg-rose-500/10 text-rose-500 border border-rose-500/30" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                    )}>
                      {userRole || 'Analyst'}
                    </span>
                    {userRole === 'admin' && <Shield size={8} className="text-rose-500" />}
                  </div>
                </div>
              </div>
              <button 
                onClick={handleLogout} 
                className="w-full py-2 bg-slate-900/50 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2 border border-slate-800 border-dashed"
              >
                <LogOut size={12} /> Sign Out Session
              </button>
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-grow md:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Search intelligence..." 
                className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full md:w-64"
              />
            </div>
            <button className="hidden md:flex bg-slate-900 border border-slate-800 p-2 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
              <Globe size={20} />
            </button>
            <div className="h-6 w-px bg-slate-800 hidden md:block mx-1"></div>
            {user ? (
               <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg pr-2 pl-1 py-1">
                 {user.photoURL ? (
                   <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-md" />
                 ) : (
                   <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                     {user.displayName?.charAt(0) || 'U'}
                   </div>
                 )}
                 <span className="text-xs font-semibold text-slate-300 hidden md:block mx-1">{user.displayName || 'Analyst'}</span>
                 <button 
                   onClick={handleLogout}
                   title="Sign Out"
                   className="p-1 text-slate-500 hover:text-rose-500 hover:bg-slate-800 rounded transition-colors"
                 >
                   <LogOut size={14} />
                 </button>
               </div>
            ) : (
               <button 
                 onClick={() => setShowLogin(true)}
                 className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
               >
                 Sign In
               </button>
            )}
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Corpus C Size" value={stats.corpusSize.toString()} icon={Activity} color="bg-indigo-500/10 text-indigo-400" trend="+12.4%" sparkData={[30, 45, 38, 65, 48, 72, 55]} />
                  <StatCard title="H-Set (Cyber)" value={stats.hSetSize.toString()} icon={Shield} color="bg-rose-500/10 text-rose-400" trend="+8.1%" sparkData={[20, 32, 45, 38, 52, 60, 68]} />
                  <StatCard title="B-Set (Other)" value={stats.bSetSize.toString()} icon={Globe} color="bg-slate-800 text-slate-400" trend="-2.4%" sparkData={[80, 75, 82, 70, 65, 62, 58]} />
                  <StatCard title="Outliers Detected" value={stats.outliersCount.toString()} icon={AlertTriangle} color="bg-amber-500/10 text-amber-500" trend="+4" sparkData={[5, 8, 12, 7, 15, 10, 18]} />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-10 transition-opacity" />
                  <SectionHeader title="Global Risk" subtitle="System-wide threat index" />
                  <RiskGauge value={68} />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Advanced Intelligence Feed */}
                <div className="xl:col-span-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col h-full hover:border-slate-700 transition-colors relative overflow-hidden group">
                  <div className="absolute -right-12 -bottom-12 w-24 h-24 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />
                  <div className="flex items-center justify-between mb-6">
                    <SectionHeader title="Cyber Pulse" subtitle="Real-time telemetry" />
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/20 rounded-full">
                       <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Live</span>
                       <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <LiveActivityFeed />
                  </div>
                  <button className="w-full mt-4 py-2 border border-slate-800 rounded-xl text-[10px] text-slate-500 uppercase tracking-widest font-bold hover:bg-slate-800 hover:text-slate-300 transition-all">
                    System Logs
                  </button>
                </div>

                {/* Threat Intensity Profile */}
                <div className="xl:col-span-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group h-full hover:border-slate-700 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <Activity size={120} className="text-indigo-400" />
                  </div>
                  <div className="absolute -left-16 -top-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <SectionHeader title="Threat Intensity Matrix" subtitle="Global impact levels by category" />
                  <div className="h-64 mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={THREAT_CATEGORIES}>
                        <PolarGrid stroke="#1e293b" />
                        <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 600 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} axisLine={false} />
                        <Radar
                          name="Intensity"
                          dataKey="intensity"
                          stroke="#6366f1"
                          fill="#6366f1"
                          fillOpacity={0.4}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                          itemStyle={{ color: '#f8fafc', fontSize: '10px' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-6">
                    {Object.entries(THREAT_LEVEL_COLORS).map(([level, color]) => (
                      <div key={level} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950 border border-slate-800/50 hover:border-slate-700 transition-colors">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: color }} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{level}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subjectivity vs Polarity Scatter Plot (Figure 4) */}
                <div className="xl:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-full hover:border-slate-700 transition-colors">
                  <SectionHeader title="Emotional Clustering (Figure 4)" subtitle="Mapping dataset sentiment density" />
                  <div className="h-80 mt-4 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={processedTweets}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="polarity" type="number" domain={[-1, 1]} hide />
                        <YAxis dataKey="subjectivity" type="number" domain={[0, 1]} hide />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} cursor={{ strokeDasharray: '3 3' }} />
                        <Line type="monotone" dataKey="subjectivity" stroke="transparent" dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isOutlier = payload.subjectivity > 0.6 && payload.polarity < -0.4;
                          return (
                            <motion.circle 
                              initial={{ r: 0 }}
                              animate={{ r: isOutlier ? 6 : 4 }}
                              cx={cx} 
                              cy={cy} 
                              fill={isOutlier ? '#ef4444' : '#6366f1'} 
                              stroke={isOutlier ? '#fff' : 'none'}
                              className="cursor-pointer"
                              whileHover={{ r: 8 }}
                            />
                          );
                        }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="absolute top-0 right-0 p-4 flex flex-col text-[8px] font-black text-slate-600 gap-1 pointer-events-none uppercase tracking-widest">
                       <span>Polarity Axis (X)</span>
                       <span>Subjectivity Axis (Y)</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                       <span className="text-[9px] text-rose-500 font-bold uppercase block mb-1">Outliers identified</span>
                       <span className="text-lg font-black text-white">{stats.outliersCount}</span>
                    </div>
                    <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                       <span className="text-[9px] text-indigo-400 font-bold uppercase block mb-1">Mean Polarity</span>
                       <span className="text-lg font-black text-white">-0.12</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Sentiment Distribution (Table 1) */}
                <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.05),transparent)] pointer-events-none" />
                  <SectionHeader title="Sentiment Distribution (Table 1)" subtitle="Sentiment classification breakdown" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
                    <div className="md:col-span-2 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sentimentDist} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} stroke="none" />
                          <Tooltip cursor={{ fill: '#1e293b', opacity: 0.4 }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32}>
                            {sentimentDist.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                      {sentimentDist.map(item => (
                        <div key={item.name} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center group/item hover:border-slate-600 transition-all hover:scale-[1.02]">
                          <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.name}</span>
                            <div className="flex items-center gap-2">
                               <p className="text-2xl font-black text-white">{item.value}</p>
                               <span className="text-[10px] text-slate-600 font-mono">({((item.value / stats.corpusSize) * 100).toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className={cn("w-1.5 h-12 rounded-full shadow-[0_0_15px]", item.name === 'Negative' ? "bg-rose-500 shadow-rose-500/30" : item.name === 'Positive' ? "bg-emerald-500 shadow-emerald-500/30" : "bg-slate-500 shadow-slate-500/30")} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Frequent Markers Optimized */}
                <div className="xl:col-span-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 hover:border-slate-700 transition-all">
                  <SectionHeader title="Intelligence Markers (Ψf)" subtitle="Latent word associations from dataset" />
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    {frequentMarkers.slice(0, 6).map((marker, idx) => (
                      <div key={marker.word} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 relative group overflow-hidden transition-all hover:border-indigo-500/50">
                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2 py-0.5 bg-slate-900 rounded-full text-[9px] text-indigo-400 font-black border border-slate-800">#{idx + 1}</span>
                          <span className="text-[10px] text-slate-600 font-mono font-bold tracking-tighter">{(marker.support * 100).toFixed(1)}%</span>
                        </div>
                        <h4 className="text-sm font-bold text-white tracking-tight truncate">{marker.word}</h4>
                        <div className="mt-3 w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${marker.support * 250}%` }}
                            className="h-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 p-4 bg-indigo-600/5 rounded-2xl border border-indigo-500/10">
                    <p className="text-[10px] text-slate-500 leading-relaxed italic">
                      <Info size={12} className="inline mr-1 mb-0.5 text-indigo-400" />
                      Visualizing latent variables discovered via Apriori associating cyber-relevant terms.
                    </p>
                  </div>
                </div>
              </div>

              {/* Research Insights Summary */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-indigo-500/20">
                 <div className="max-w-2xl text-center md:text-left">
                    <h2 className="text-3xl font-black text-white mb-4 italic tracking-tight underline decoration-indigo-300 underline-offset-8">Intelligence Synthesis</h2>
                    <p className="text-indigo-100 text-sm leading-relaxed mb-6 opacity-90">
                      Our current dataset reveals a <span className="font-black text-white">0.84 correlation</span> between technical markers and negative emotional intensity. This synthesis suggests that highly sophisticated threat actors utilize more aggressive sentiment patterns compared to general-purpose accounts.
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                       <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-2">
                          <TrendingUp size={16} className="text-emerald-300" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Growth in H-Set (+12%)</span>
                       </div>
                       <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-2">
                          <BrainCircuit size={16} className="text-indigo-300" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Sentiment Precision 92%</span>
                       </div>
                    </div>
                 </div>
                 <div className="shrink-0">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl rotate-3 hover:rotate-0 transition-transform cursor-crosshair">
                       <Zap size={48} className="text-indigo-600" />
                    </div>
                 </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
                  <SectionHeader title="Critical Intelligence Alerts" subtitle="Recent anomalies requiring immediate review" />
                  <button onClick={() => setActiveTab('alerts')} className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-700 hover:text-white transition-all">
                    System Alert Hub
                  </button>
                </div>
                <div className="divide-y divide-slate-800/50">
                  {triggeredAlerts.length > 0 ? triggeredAlerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="p-5 flex items-center justify-between hover:bg-slate-800/20 transition-all group">
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110",
                          alert.value > 100 ? "bg-rose-500/10 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]" : "bg-indigo-500/10 text-indigo-500"
                        )}>
                          <AlertTriangle size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                             <h4 className="text-sm font-black text-white tracking-tight">{alert.type}</h4>
                             <span className="text-[9px] text-slate-600 font-mono font-bold tracking-widest uppercase">{alert.timestamp}</span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium italic mb-2">"{alert.info}"</p>
                          <div className="flex items-center gap-3">
                             <span className="text-[9px] px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-500 font-black uppercase tracking-widest">Source: {alert.source}</span>
                             <div className="flex items-center gap-1">
                                <Activity size={10} className="text-slate-700" />
                                <span className="text-[9px] text-slate-600 font-black uppercase">Intensity {alert.value}%</span>
                             </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                          alert.value > 100 ? "bg-rose-500/20 text-rose-500 border-rose-500/30" : "bg-indigo-500/20 text-indigo-500 border-indigo-500/30"
                        )}>
                          {alert.value > 100 ? 'Critical' : 'Priority'}
                        </div>
                        <button className="text-[9px] text-indigo-400 font-black uppercase tracking-widest hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                           Analysis Report
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="p-12 text-center">
                       <ShieldCheck className="mx-auto text-slate-800 mb-4" size={48} />
                       <p className="text-slate-500 text-sm font-medium">System reports no critical anomalies in the current cycle.</p>
                    </div>
                  )}
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
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
                      <Languages size={14} className="text-indigo-400" />
                      <select 
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="bg-transparent text-xs text-white focus:outline-none"
                      >
                        <option value="en">English (Default)</option>
                        <option value="ru">Russian</option>
                        <option value="zh">Chinese</option>
                        <option value="es">Spanish</option>
                        <option value="ar">Arabic</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">AI Translation Enabled</span>
                  </div>
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
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleExportSTIX}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all border border-slate-700 shadow-lg"
                    >
                      <Share2 size={18} className="text-emerald-400" />
                      Export STIX 2.1
                    </button>
                    <button
                      onClick={handleExportReport}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all border border-slate-700 shadow-lg"
                    >
                      <FileText size={18} className="text-indigo-400" />
                      Export Report (.txt)
                    </button>
                  </div>
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
                            <div className="bg-slate-950/30 p-5 rounded-xl border border-slate-800/50">
                              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Threat Actor Profile</h4>
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold">Sophistication</span>
                                  <p className="text-sm text-slate-300">{analysisResult.aiReport.threatActorProfile.sophistication}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold">Motivation</span>
                                  <p className="text-sm text-slate-300">{analysisResult.aiReport.threatActorProfile.motivation}</p>
                                </div>
                                {analysisResult.aiReport.threatActorProfile.potentialAffiliation && (
                                  <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Potential Affiliation</span>
                                    <p className="text-sm text-slate-300">{analysisResult.aiReport.threatActorProfile.potentialAffiliation}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="bg-slate-950/30 p-5 rounded-xl border border-slate-800/50">
                              <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] mb-3">Strategic Intent</h4>
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold">Short-Term Goal</span>
                                  <p className="text-sm text-slate-300">{analysisResult.aiReport.strategicIntent.shortTermGoal}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold">Long-Term Objective</span>
                                  <p className="text-sm text-slate-300">{analysisResult.aiReport.strategicIntent.longTermObjective}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="bg-slate-950/30 p-5 rounded-xl border border-slate-800/50">
                              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Emotional Subtext</h4>
                              <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-indigo-500 pl-4 py-1">
                                "{analysisResult.aiReport.emotionalSubtext}"
                              </p>
                            </div>

                            <div className="bg-slate-950/30 p-5 rounded-xl border border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
                              <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-3">Countermeasures</h4>
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-emerald-500/60 uppercase font-bold">Immediate Action</span>
                                  <p className="text-sm text-slate-200">{analysisResult.aiReport.countermeasures.immediateAction}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] text-emerald-500/60 uppercase font-bold">Long-Term Prevention</span>
                                  <p className="text-sm text-slate-200">{analysisResult.aiReport.countermeasures.longTermPrevention}</p>
                                </div>
                              </div>
                            </div>

                            {analysisResult.aiReport.slangDecoded && (
                              <div className="md:col-span-2">
                                <h4 className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Terminal size={14} /> Slang/Jargon Decoded
                                </h4>
                                <p className="text-sm text-rose-200 bg-rose-500/5 p-4 rounded-xl border border-rose-500/20 font-mono italic">
                                  {analysisResult.aiReport.slangDecoded}
                                </p>
                              </div>
                            )}
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

          {/* Heatmap Tab */}
          {activeTab === 'heatmap' && (
            <motion.div 
              key="heatmap"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <GlobalHeatmap />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LiveFeed />
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <SectionHeader title="Regional Sentiment Breakdown" subtitle="Emotional intensity by geographic region." />
                  <div className="space-y-6">
                    {[
                      { region: 'North America', intensity: 45, emotion: 'Neutral', color: 'bg-indigo-500' },
                      { region: 'Eastern Europe', intensity: 92, emotion: 'Fear', color: 'bg-orange-500' },
                      { region: 'East Asia', intensity: 78, emotion: 'Anger', color: 'bg-rose-500' },
                      { region: 'Western Europe', intensity: 35, emotion: 'Surprise', color: 'bg-amber-500' },
                    ].map(r => (
                      <div key={r.region} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-white">{r.region}</span>
                          <span className="text-xs text-slate-400">{r.emotion} ({r.intensity}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                          <div className={cn("h-full", r.color)} style={{ width: `${r.intensity}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <motion.div 
              key="alerts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                <SectionHeader title="Automated Alert System" subtitle="Configure thresholds for emotional intensity to trigger automated intelligence alerts." />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {alerts.map(alert => (
                    <div key={alert.id} className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4 relative group">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            alert.type === 'intensity' ? "bg-indigo-600/10 text-indigo-400" :
                            alert.type === 'keyword' ? "bg-emerald-600/10 text-emerald-400" :
                            alert.type === 'emotion' ? "bg-rose-600/10 text-rose-400" : "bg-amber-600/10 text-amber-400"
                          )}>
                            {alert.type === 'intensity' && <Activity size={20} />}
                            {alert.type === 'keyword' && <Terminal size={20} />}
                            {alert.type === 'emotion' && <Ghost size={20} />}
                            {alert.type === 'threatType' && <Shield size={20} />}
                          </div>
                          <div>
                            <h4 className="font-bold text-white leading-tight">{alert.name}</h4>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Type: {alert.type}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setAlerts(alerts.map(a => a.id === alert.id ? { ...a, active: !a.active } : a))}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1 rounded border transition-all",
                            alert.active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-slate-800 border-slate-700 text-slate-500"
                          )}
                        >
                          <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", alert.active ? "bg-emerald-500" : "bg-slate-600")} />
                          <span className="text-[8px] font-black uppercase tracking-widest">{alert.active ? 'Active' : 'Muted'}</span>
                        </button>
                      </div>
                      
                      <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
                        {alert.type === 'intensity' && (
                          <div className="space-y-3">
                            <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-slate-500">
                              <span>{alert.category} Level Threshold</span>
                              <span className="text-white font-mono">{alert.threshold}</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max="150" 
                              value={alert.threshold}
                              onChange={(e) => setAlerts(alerts.map(a => a.id === alert.id ? { ...a, threshold: parseInt(e.target.value) } : a))}
                              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                          </div>
                        )}
                        {alert.type === 'keyword' && (
                          <div className="space-y-1">
                            <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Match Pattern</span>
                            <input 
                              type="text"
                              value={alert.value}
                              onChange={(e) => setAlerts(alerts.map(a => a.id === alert.id ? { ...a, value: e.target.value } : a))}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-indigo-400 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>
                        )}
                        {alert.type === 'emotion' && (
                          <div className="space-y-2">
                            <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Target Emotion</span>
                            <select 
                              value={alert.category}
                              onChange={(e) => setAlerts(alerts.map(a => a.id === alert.id ? { ...a, category: e.target.value } : a))}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-rose-400 focus:outline-none"
                            >
                              {EMOTION_RADAR.map(e => <option key={e.subject} value={e.subject}>{e.subject}</option>)}
                            </select>
                          </div>
                        )}
                        {alert.type === 'threatType' && (
                          <div className="space-y-2">
                            <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Detected Signature</span>
                            <input 
                              type="text"
                              value={alert.value}
                              onChange={(e) => setAlerts(alerts.map(a => a.id === alert.id ? { ...a, value: e.target.value } : a))}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-amber-500 focus:outline-none placeholder:text-slate-700"
                              placeholder="e.g. Ransomware, APT..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-[9px]">
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-widest">
                          <History size={10} />
                          Triggered: <span className="text-slate-300">{alert.lastTriggered}</span>
                        </div>
                        <button 
                          onClick={() => setAlerts(alerts.filter(a => a.id !== alert.id))}
                          className="text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Delete Rule
                        </button>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={handleAddAlert}
                    className="border-2 border-dashed border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-all"
                  >
                    <Zap size={24} />
                    <span className="text-sm font-bold">Add New Alert Rule</span>
                  </button>
                </div>

                <div className="mt-12 space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <History size={18} className="text-rose-500" />
                    Recent Alert Log (Last 24h)
                  </h3>
                  <div className="space-y-3">
                    {triggeredAlerts.map(alert => (
                      <div key={alert.id} className="bg-slate-950/50 border border-slate-800/50 p-4 rounded-xl flex items-center gap-4 hover:bg-slate-950 transition-colors">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          alert.type === 'Aggression' ? "bg-rose-500/10 text-rose-500" : "bg-orange-500/10 text-orange-500"
                        )}>
                          <AlertTriangle size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-xs font-bold text-white uppercase tracking-tighter">Trigger Violation: {alert.type} ({alert.value}%)</h4>
                            <span className="text-[10px] text-slate-500 font-mono">{alert.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 italic">"{alert.info}"</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-500 uppercase">Source: {alert.source}</span>
                            <button className="text-[9px] text-indigo-400 hover:underline uppercase">View Full Dataset</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Collaboration Tab */}
          {activeTab === 'collaboration' && (
            <motion.div 
              key="collaboration"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <SectionHeader title="Shared Intelligence Portal" subtitle="Collaborate with other analysts on threat reports and findings." />
                    <div className="space-y-6">
                      {comments.map(post => (
                        <div key={post.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">{post.avatar}</div>
                              <div>
                                <h4 className="text-sm font-bold text-white">{post.author}</h4>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{post.time}</p>
                              </div>
                            </div>
                            <button className="text-slate-500 hover:text-white transition-colors"><Share2 size={16} /></button>
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed">{post.content}</p>
                          <div className="flex items-center gap-6 pt-2">
                            <button className="flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                              <ThumbsUp size={14} /> {post.upvotes}
                            </button>
                            <button className="flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                              <MessageCircle size={14} /> {post.comments}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6">
                      <textarea 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Share a new finding or insight..."
                        className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      />
                      <div className="flex justify-end mt-2">
                        <button 
                          onClick={handleAddComment}
                          className="px-6 py-2 bg-indigo-600 hover:bg-white text-white hover:text-indigo-600 rounded-lg text-xs font-bold transition-all"
                        >
                          Post Insight
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <TrendingUp size={18} className="text-indigo-500" />
                      Trending Intelligence
                    </h3>
                    <div className="space-y-3">
                      {trendingTopics.map(t => (
                        <div key={t.topic} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center group hover:border-indigo-500/30 transition-all cursor-pointer">
                          <div>
                            <p className="text-xs font-bold text-white group-hover:text-indigo-400">{t.topic}</p>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">{t.volume} Volume</span>
                          </div>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                            t.sentiment === 'Negative' ? "bg-rose-500/10 text-rose-500" : 
                            t.sentiment === 'Aggressive' ? "bg-orange-500/10 text-orange-500" : "bg-slate-800 text-slate-400"
                          )}>
                            {t.sentiment}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <Users size={18} className="text-indigo-500" />
                      Active Analysts
                    </h3>
                    {/* analysts list ... */}
                    <div className="space-y-4">
                      {[
                        { name: 'Analyst_Alpha', status: 'Online', role: 'Senior Auditor', location: 'UK' },
                        { name: 'CTI_Expert', status: 'Online', role: 'Threat Hunter', location: 'USA' },
                        { name: 'Cyber_Sentinel', status: 'Away', role: 'Security Analyst', location: 'GER' },
                      ].map(a => (
                        <div key={a.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-2 rounded-full", a.status === 'Online' ? "bg-emerald-500" : "bg-slate-700")} />
                            <div>
                              <p className="text-xs font-bold text-white">{a.name} <span className="text-[8px] text-slate-600 ml-1">[{a.location}]</span></p>
                              <p className="text-[10px] text-slate-500">{a.role}</p>
                            </div>
                          </div>
                          <button className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <MessageSquare size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Dark Web Tab */}
          {activeTab === 'darkweb' && (
            <motion.div 
              key="darkweb"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <div className="bg-slate-900 border-2 border-rose-500/20 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
                    <Terminal size={12} className="text-rose-500" />
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Encrypted Session</span>
                  </div>
                </div>
                
                <SectionHeader title="Dark Web Forum Simulator" subtitle="Analyze underground communications with specialized slang recognition." />
                
                <div className="mb-6 flex gap-3">
                  {['Russian Ransomware Forum', 'Turkish Market Leak', 'General Underground', 'Hacker Recruitment Board'].map(ctx => (
                    <button
                      key={ctx}
                      onClick={() => setForumContext(ctx)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                        forumContext === ctx ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                      )}
                    >
                      {ctx}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-500 space-y-1">
                      <p className="opacity-50 text-[9px]"># ID: DW-SIM-RX-402</p>
                      <p className="opacity-50 text-[9px]"># CONTEXT: {forumContext}</p>
                      <p className="opacity-50"># Initializing slang-aware NLP engine...</p>
                      <p className="opacity-50"># Loading underground lexicon (v2.4)...</p>
                      <p># Ready for analysis.</p>
                    </div>
                    
                    <textarea 
                      value={analysisText}
                      onChange={(e) => setAnalysisText(e.target.value)}
                      placeholder="Paste dark web forum post here..."
                      className="w-full h-48 bg-slate-950 border border-rose-500/20 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500/50 font-mono"
                    />
                    
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setAnalysisText('Selling fresh logs from major US bank. 10k+ records. No lowballers. Escrow only.')}
                          className="text-[10px] px-2 py-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-400"
                        >
                          Sample: Market
                        </button>
                        <button 
                          onClick={() => setAnalysisText('Need a reliable FUD crypter for my latest payload. Willing to pay top dollar.')}
                          className="text-[10px] px-2 py-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-400"
                        >
                          Sample: Tooling
                        </button>
                      </div>
                      <button 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !analysisText}
                        className="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-600/20 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isAnalyzing ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Skull size={18} />
                        )}
                        Analyze Underground Intel
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
                      <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-4">Slang Recognition (δ-Underground)</h3>
                      <div className="space-y-3">
                        {[
                          { term: 'FUD', meaning: 'Fully Undetectable' },
                          { term: 'Logs', meaning: 'Stolen credentials/data' },
                          { term: 'Crypter', meaning: 'Tool to hide malware' },
                          { term: 'Escrow', meaning: 'Trusted third-party payment' },
                          { term: 'Payload', meaning: 'Malicious part of malware' },
                        ].map(s => (
                          <div key={s.term} className="flex justify-between items-center p-2 bg-slate-900 rounded border border-slate-800">
                            <span className="text-xs font-bold text-white font-mono">{s.term}</span>
                            <span className="text-[10px] text-slate-500">{s.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
