import { z } from 'zod';

const blockBase = {
  id: z.string().min(1),
  anchor: z.string().optional(),
  hiddenOn: z.enum(['mobile', 'desktop']).optional(),
};

const HeroBlock = z.object({
  ...blockBase,
  type: z.literal('hero'),
  props: z.object({
    backgroundImageAssetId: z.string().optional(),
    headline: z.string(),
    subheadline: z.string().optional(),
    ctaLabel: z.string().optional(),
    ctaUrl: z.string().optional(),
  }),
});

const RichTextBlock = z.object({
  ...blockBase,
  type: z.literal('richText'),
  props: z.object({
    html: z.string(),
  }),
});

const ImageSingleBlock = z.object({
  ...blockBase,
  type: z.literal('imageSingle'),
  props: z.object({
    assetId: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
  }),
});

const ImpactStatItem = z.object({
  icon: z.string(),
  value: z.string(),
  label: z.string(),
});

const ImpactStatsBlock = z.object({
  ...blockBase,
  type: z.literal('impactStats'),
  props: z.object({
    items: z.array(ImpactStatItem).max(6),
  }),
});

const FundraisingProgressBlock = z.object({
  ...blockBase,
  type: z.literal('fundraisingProgress'),
  props: z.object({
    showGoal: z.boolean().optional(),
    showDonorCount: z.boolean().optional(),
    showDeadline: z.boolean().optional(),
  }),
});

const FaqItem = z.object({
  question: z.string(),
  answer: z.string(),
});

const FaqBlock = z.object({
  ...blockBase,
  type: z.literal('faq'),
  props: z.object({
    items: z.array(FaqItem),
  }),
});

const DonationQuickFormBlock = z.object({
  ...blockBase,
  type: z.literal('donationQuickForm'),
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

const SnsShareBlock = z.object({
  ...blockBase,
  type: z.literal('snsShare'),
  props: z.object({
    message: z.string().optional(),
    platforms: z.array(z.enum(['twitter', 'facebook', 'kakao', 'link'])).optional(),
  }),
});

export const BlockSchema = z.discriminatedUnion('type', [
  HeroBlock,
  RichTextBlock,
  ImageSingleBlock,
  ImpactStatsBlock,
  FundraisingProgressBlock,
  FaqBlock,
  DonationQuickFormBlock,
  SnsShareBlock,
]);

export type Block = z.infer<typeof BlockSchema>;

export const PageContentSchema = z.object({
  meta: z.object({
    schemaVersion: z.literal(1),
  }),
  blocks: z.array(BlockSchema).max(50),
});

export type PageContent = z.infer<typeof PageContentSchema>;
