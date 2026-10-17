/**
 * 공유 — 채널별 공유를 한곳에서 처리한다.
 *
 * 카카오톡처럼 외부 SDK가 필요한 채널은 provider로 나중에 등록한다(registerShareProvider).
 * 등록 전에는 휴대폰 공유 창(Web Share) → 링크 복사 순으로 대신한다. 그래서 버튼이 아무 일도 안 하는 일이 없다.
 * 공유 링크에는 utm_source=<채널>&utm_medium=share 를 붙여 기존 유입 경로 통계에 잡히게 한다.
 */
export type ShareChannel = "kakao" | "facebook" | "link";

export type ShareContent = {
  url: string;
  title: string;
  text?: string;
  imageUrl?: string;
};

/** shared: 채널로 공유함 / native: 기기 공유 창을 띄움 / copied: 링크를 복사함 / failed: 아무것도 못 함 */
export type ShareOutcome = "shared" | "native" | "copied" | "failed";

export type ShareProvider = {
  /** SDK 로드·초기화가 끝나 바로 공유할 수 있는지 */
  isReady(): boolean;
  share(content: ShareContent): Promise<void>;
};

const providers = new Map<ShareChannel, ShareProvider>();

export function registerShareProvider(channel: ShareChannel, provider: ShareProvider | null): void {
  if (provider) providers.set(channel, provider);
  else providers.delete(channel);
}

export function hasShareProvider(channel: ShareChannel): boolean {
  return providers.get(channel)?.isReady() ?? false;
}

/** 공유 링크에 유입 경로 표시를 붙인다(이미 utm_source가 있으면 그대로 둔다) */
export function withShareUtm(url: string, channel: ShareChannel): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", channel);
      u.searchParams.set("utm_medium", "share");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withShareUtm(url, "facebook"))}`;
}

type ShareEnv = {
  share?: (data: { url?: string; title?: string; text?: string }) => Promise<void>;
  copy?: (text: string) => Promise<void>;
};

function browserEnv(): ShareEnv {
  if (typeof navigator === "undefined") return {};
  return {
    share: typeof navigator.share === "function" ? (d) => navigator.share(d) : undefined,
    copy: navigator.clipboard ? (t) => navigator.clipboard.writeText(t) : undefined,
  };
}

/**
 * 채널로 공유한다. provider가 없거나 실패하면 기기 공유 창, 그것도 없으면 링크 복사.
 * env는 테스트용 — 기본은 브라우저.
 */
export async function shareTo(channel: ShareChannel, content: ShareContent, env: ShareEnv = browserEnv()): Promise<ShareOutcome> {
  const tagged = { ...content, url: withShareUtm(content.url, channel) };

  const provider = providers.get(channel);
  if (channel !== "link" && provider?.isReady()) {
    try {
      await provider.share(tagged);
      return "shared";
    } catch {
      // 대체 경로로 계속
    }
  }

  if (channel !== "link" && env.share) {
    try {
      await env.share({ url: tagged.url, title: tagged.title, text: tagged.text });
      return "native";
    } catch (e) {
      // 사용자가 공유 창을 닫은 것 — 복사로 넘어가지 않는다
      if (e instanceof Error && e.name === "AbortError") return "native";
    }
  }

  if (env.copy) {
    try {
      await env.copy(tagged.url);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
