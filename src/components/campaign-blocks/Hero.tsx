import Image from 'next/image';

// G-D94: any → 구체 타입
type HeroProps = {
  backgroundImageAssetId?: string | null;
  headline: string;
  subheadline?: string | null;
  ctaLabel: string;
  ctaAnchorBlockId?: string | null;
};

export function Hero({ block }: { block: { props: HeroProps } }) {
  const { backgroundImageAssetId, headline, subheadline, ctaLabel, ctaAnchorBlockId } = block.props;
  return (
    <section className="relative h-[70vh] min-h-[420px] w-full overflow-hidden">
      {backgroundImageAssetId ? (
        <Image src={backgroundImageAssetId} alt="" fill priority className="object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center text-white">
        <h1 className="text-4xl font-bold md:text-6xl">{headline}</h1>
        {subheadline ? <p className="mt-4 max-w-2xl text-lg">{subheadline}</p> : null}
        <a
          href={ctaAnchorBlockId ? `#${ctaAnchorBlockId}` : '#donate'}
          className="mt-8 rounded-full px-8 py-3 font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}
