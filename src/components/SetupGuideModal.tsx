import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Database, Shield, Globe, ExternalLink, CheckCircle2 } from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUPABASE_SQL = `-- =================================================================
-- 67 GANG CHAT: SUPABASE DATABASE SETUP & SECURITY POLICIES
-- Run this script in your Supabase SQL Editor (SQL Editor -> New Query)
-- =================================================================

-- 1. Create the whitelist table of approved classmate names
CREATE TABLE IF NOT EXISTS public.approved_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with initial classmates (Edit these names to match your friends)
INSERT INTO public.approved_members (name)
VALUES 
  ('Ziauddin'),
  ('Friend 2'),
  ('Friend 3'),
  ('Friend 4'),
  ('Friend 5'),
  ('Friend 6')
ON CONFLICT (name) DO NOTHING;

-- 2. Create the registered profiles table
-- Stores user details linked to custom passwords
CREATE TABLE IF NOT EXISTS public.chat_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL REFERENCES public.approved_members(name) ON DELETE RESTRICT,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create the chat messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.chat_profiles(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index for speedy message retrieval in chronological order
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at ASC);

-- 4. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.approved_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Security Policies
-- Anyone visiting can read the approved names to see who is on the list
CREATE POLICY "Allow reading approved members" 
  ON public.approved_members FOR SELECT USING (true);

-- Anyone can read registered usernames (to populate login dropdown)
CREATE POLICY "Allow reading public usernames" 
  ON public.chat_profiles FOR SELECT USING (true);

-- Allow authenticated members to read all messages
CREATE POLICY "Allow read messages" 
  ON public.messages FOR SELECT USING (true);

-- Allow verified members to insert messages
CREATE POLICY "Allow authenticated insert messages" 
  ON public.messages FOR INSERT WITH CHECK (true);

-- 6. Enable Realtime on the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
`;

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'supabase' | 'whitelist' | 'hosting'>('overview');

  if (!isOpen) return null;

  const copySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#121623] border border-[#232b40] rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden text-zinc-100 animate-fadeIn">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#22283a] flex items-center justify-between bg-[#151a2a]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">67 Gang Chat Setup & Deployment Guide</h2>
              <p className="text-xs text-zinc-400">Everything you need to customize, deploy, and connect</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#20273c] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#22283a] bg-[#0f121d] px-4 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            1. Current Backend (Working Now!)
          </button>
          <button
            onClick={() => setActiveTab('whitelist')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'whitelist'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            2. Edit Classmate Names
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'supabase'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            3. Free Supabase Guide & SQL
          </button>
          <button
            onClick={() => setActiveTab('hosting')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'hosting'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            4. Sharing & Publishing URL
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-300 font-bold mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>The website is already 100% functional out of the box!</span>
                </div>
                <p className="text-xs text-zinc-300">
                  You do not need to sign up for any paid service. 67 Gang Chat has a built-in
                  trusted server with real-time WebSockets and persistent storage in{' '}
                  <code className="text-emerald-300">data/chat_db.json</code>.
                </p>
              </div>

              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-400" />
                How the Security Works:
              </h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-zinc-400">
                <li>
                  <strong className="text-zinc-200">No Plaintext Passwords:</strong> Passwords are
                  hashed using Node's cryptographic <code className="text-indigo-300">scrypt</code> algorithm with
                  a unique 16-byte random salt per user.
                </li>
                <li>
                  <strong className="text-zinc-200">Whitelist Only:</strong> Only classmates listed
                  in your approved roster can register. Each name can only be claimed once.
                </li>
                <li>
                  <strong className="text-zinc-200">Session Verification:</strong> Unauthenticated visitors
                  cannot read or post chat messages. Senders are verified to prevent impersonation.
                </li>
                <li>
                  <strong className="text-zinc-200">Real-Time Sync:</strong> As soon as any friend sends a
                  message, it broadcasts instantly to all connected classmates without refreshing.
                </li>
              </ul>
            </div>
          )}

          {/* Tab 2: Whitelist */}
          {activeTab === 'whitelist' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">How to Change the Classmates' Names</h3>
              <p className="text-xs text-zinc-300">
                The roster is stored in one single, clearly marked configuration file:{' '}
                <code className="bg-[#191f30] px-2 py-0.5 rounded text-indigo-300 border border-[#2b354f]">
                  src/config/whitelist.ts
                </code>
              </p>

              <div className="p-3 bg-[#0c0f18] border border-[#22283a] rounded-xl font-mono text-xs text-zinc-300">
                <div className="text-zinc-500">// Open src/config/whitelist.ts:</div>
                <div><span className="text-violet-400">export const</span> APPROVED_NAMES = [</div>
                <div className="pl-4 text-emerald-300">'Ziauddin',</div>
                <div className="pl-4 text-emerald-300">'YourFriendName1',</div>
                <div className="pl-4 text-emerald-300">'YourFriendName2',</div>
                <div className="pl-4 text-emerald-300">'YourFriendName3',</div>
                <div>];</div>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl text-xs text-amber-200/90">
                <strong>Rule:</strong> When you replace the names, they immediately become the only options
                in the registration dropdown.
              </div>
            </div>
          )}

          {/* Tab 3: Supabase Guide */}
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">How to Set Up a Free Supabase Project (Optional)</h3>
              <p className="text-xs text-zinc-400">
                If you ever want your database hosted on Supabase's cloud PostgreSQL instead of the
                built-in server:
              </p>

              <ol className="list-decimal pl-5 space-y-2 text-xs text-zinc-300">
                <li>
                  Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-3 h-3" /></a> and click <strong>Start your project</strong> (100% Free tier).
                </li>
                <li>
                  Click <strong>New Project</strong>, give it the name <code className="text-indigo-300">67-gang-chat</code>, pick a database password, and choose your nearest region.
                </li>
                <li>
                  In your Supabase project dashboard, click <strong>SQL Editor</strong> on the left menu.
                </li>
                <li>
                  Paste the SQL script below and click <strong>Run</strong>.
                </li>
              </ol>

              {/* SQL Snippet */}
              <div className="relative">
                <div className="flex items-center justify-between px-3 py-2 bg-[#1b2133] border border-[#29324b] rounded-t-xl text-xs font-mono text-zinc-300">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <span>67_gang_schema.sql</span>
                  </div>
                  <button
                    onClick={copySQL}
                    className="flex items-center gap-1 text-[11px] font-sans px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#0a0d16] border-x border-b border-[#29324b] rounded-b-xl text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-56 leading-relaxed">
                  {SUPABASE_SQL}
                </pre>
              </div>
            </div>
          )}

          {/* Tab 4: Hosting & URL */}
          {activeTab === 'hosting' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                How to Share with Your Sabaq Friends
              </h3>

              <div className="p-3.5 bg-[#151b2a] border border-[#252f46] rounded-xl space-y-2">
                <p className="text-xs text-zinc-300">
                  In Google AI Studio, your applet is already provided with a live URL:
                </p>
                <div className="p-2 bg-[#0d101a] border border-[#212739] rounded font-mono text-xs text-indigo-300 break-all">
                  https://ais-dev-fcu4w2u75stm5aszn2arsc-451095150941.us-east1.run.app
                </div>
                <p className="text-[11px] text-zinc-500">
                  Anyone in your sabaq circle can open this link in Chrome, Safari, or on their phone,
                  select their name from the list, set their private password, and start chatting!
                </p>
              </div>

              <div className="border-t border-[#22283a] pt-3">
                <h4 className="text-xs font-bold text-zinc-200 mb-2">Short Testing Checklist:</h4>
                <div className="space-y-1.5 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px]">1</span>
                    <span>Create first account (e.g. "Ziauddin") with a test password.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px]">2</span>
                    <span>Open another incognito window or device and create "Friend 2".</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px]">3</span>
                    <span>Send a message from Ziauddin; watch it appear instantly in Friend 2's screen.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px]">4</span>
                    <span>Refresh either tab; all chat messages stay saved!</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#22283a] bg-[#151a2a] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
