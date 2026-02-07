import OpenAI from 'openai';

// 지연 초기화 (빌드 시점에 환경 변수가 없어도 에러 안 남)
let openaiInstance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

// AI 토론자 시스템 프롬프트
export function getDebaterSystemPrompt(role: 'pro' | 'con', topic: string): string {
  const stance = role === 'pro' ? '찬성' : '반대';
  
  return `당신은 토론 게임의 AI 참가자입니다. 
주제: "${topic}"
당신의 입장: ${stance}

규칙:
1. 항상 ${stance} 입장에서 논리적이고 설득력 있는 주장을 펼치세요.
2. 상대방의 주장에 대해 구체적으로 반박하세요.
3. 감정적인 표현보다는 논리와 근거에 기반한 주장을 사용하세요.
4. 답변은 간결하면서도 핵심을 담아 1문단 이내로 작성하세요.
5. 한국어로 답변하세요.`;
}

// AI 심판 시스템 프롬프트
// AI 주제 생성 시스템 프롬프트
export const TOPIC_GENERATOR_PROMPT = `당신은 토론 주제 생성기입니다.
흥미롭고 논쟁적인 토론 주제를 1개 생성하세요.
찬반이 명확히 나뉠 수 있는 주제여야 합니다.
한 문장으로 작성하세요.
따옴표나 번호 없이 주제 문장만 출력하세요.`;

// AI 주제 생성 함수 (서버 사이드 재사용)
export async function generateTopic(): Promise<string> {
  const { getRandomTopic } = await import('@/lib/gameLogic');
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: TOPIC_GENERATOR_PROMPT },
        { role: 'user', content: '새로운 토론 주제를 하나 제시해주세요.' },
      ],
      max_tokens: 100,
      temperature: 1.0,
    });
    return completion.choices[0]?.message?.content?.trim() || getRandomTopic();
  } catch (error) {
    console.error('[generateTopic] OpenAI 호출 실패:', error);
    return getRandomTopic();
  }
}

// AI 심판 시스템 프롬프트
export const JUDGE_SYSTEM_PROMPT = `당신은 토론 게임의 공정한 심판입니다.

평가 기준:
1. 논리성 (40%): 주장의 논리적 일관성과 타당성
2. 근거 (30%): 주장을 뒷받침하는 근거의 적절성
3. 반론 대응 (20%): 상대방 주장에 대한 효과적인 반박
4. 표현력 (10%): 명확하고 설득력 있는 표현

각 참가자에 대해:
- 0-100점 사이의 점수를 부여하세요.
- 구체적인 피드백을 제공하세요.
- 강점과 개선점을 명시하세요.

최종적으로 승리 팀(pro/con/draw)을 결정하고, 전체 토론에 대한 분석을 제공하세요.

반드시 다음 JSON 형식으로 응답하세요:
{
  "winnerTeam": "pro" | "con" | "draw",
  "scores": {
    "playerId1": 점수,
    "playerId2": 점수,
    ...
  },
  "feedback": {
    "playerId1": "피드백 내용",
    "playerId2": "피드백 내용",
    ...
  },
  "overallAnalysis": "전체 토론 분석"
}`;
