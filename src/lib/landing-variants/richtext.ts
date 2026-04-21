import { registerVariants } from './index'
import * as S from './richtext-schemas'

registerVariants('richtext', [
  { id: 'richtext-plain', type: 'richtext', label: '평문',
    description: '일반 HTML 영역. 현재 기본.',
    preview: '/landing-variants/richtext-plain.svg', visualWeight: 'minimal',
    dataSchema: S.RichtextPlain, defaultData: S.richtextPlainDefault },
  { id: 'richtext-boxed', type: 'richtext', label: '강조 박스',
    description: '배경 + 좌측 강조선 박스.',
    preview: '/landing-variants/richtext-boxed.svg', visualWeight: 'minimal',
    dataSchema: S.RichtextBoxed, defaultData: S.richtextBoxedDefault },
  { id: 'richtext-quote', type: 'richtext', label: '인용문',
    description: '대형 인용문 + 작성자 cite.',
    preview: '/landing-variants/richtext-quote.svg', visualWeight: 'bold',
    dataSchema: S.RichtextQuote, defaultData: S.richtextQuoteDefault },
])
