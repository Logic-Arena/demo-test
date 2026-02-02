'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

const RoomList = dynamic(() => import('@/components/lobby/RoomList').then(m => ({ default: m.RoomList })), { 
  ssr: false,
  loading: () => <div className="text-center py-12 text-gray-700">로딩 중...</div>
});
const CreateRoomModal = dynamic(() => import('@/components/lobby/CreateRoomModal').then(m => ({ default: m.CreateRoomModal })), { 
  ssr: false 
});
import { Swords, Users, Brain, Trophy } from 'lucide-react';

export default function Home() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Logic Arena</h1>
              <p className="text-sm text-gray-700">AI-인간 하이브리드 토론 게임</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            AI와 함께하는 2:2 토론 대결
          </h2>
          <p className="text-gray-800 mb-6">
            사람과 AI가 팀을 이루어 다양한 주제에 대해 논리적으로 토론합니다.
            <br />
            당신의 논리력을 시험하고, AI 심판의 공정한 판정을 받아보세요.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900">2:2 팀 토론</h3>
                <p className="text-sm text-gray-800">사람 + AI 팀 구성</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
              <Brain className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900">AI 파트너</h3>
                <p className="text-sm text-gray-800">GPT-4가 팀원으로 참여</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg">
              <Trophy className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900">AI 심판</h3>
                <p className="text-sm text-gray-800">공정한 점수와 피드백</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            새 토론방 만들기
          </button>
        </div>

        {/* Room List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">대기 중인 토론방</h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + 새 방 만들기
            </button>
          </div>
          <RoomList />
        </div>

        {/* Game Rules */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">게임 규칙</h2>
          <div className="space-y-4 text-sm text-gray-800">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">1. 팀 구성</h3>
              <p>2명의 플레이어가 입장하면 게임이 시작됩니다. AI가 주제를 제안하고, 각자 찬성/반대를 선택합니다.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-1">2. 토론 진행</h3>
              <p>총 4번의 사이클로 진행됩니다. 각 참가자가 반론, 변론, 재반론을 번갈아 제출합니다.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-1">3. 시간 제한</h3>
              <p>각 단계마다 정해진 시간이 있습니다. 시간 내에 발언을 제출해야 합니다.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-1">4. 판정</h3>
              <p>토론이 끝나면 AI 심판이 전체 토론을 분석하고 점수와 피드백을 제공합니다.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
