import Image from 'next/image';

export function ImageSingle({ block }: { block: { props: any } }) {
  const { assetId, altText, caption, linkUrl } = block.props;
  const img = assetId ? (
    <Image src={assetId} alt={altText} width={1200} height={800} className="h-auto w-full rounded-lg" />
  ) : null;
  return (
    <figure className="mx-auto my-8 max-w-3xl px-4">
      {linkUrl ? <a href={linkUrl} target="_blank" rel="noopener noreferrer">{img}</a> : img}
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-neutral-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
