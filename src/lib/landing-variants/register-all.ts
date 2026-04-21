/**
 * 모든 variant 파일을 side-effect import.
 * `import '@/lib/landing-variants/register-all'` 로 호출하면
 * Phase A의 hero/cta/stats variants가 registry에 등록된다.
 *
 * 별도 파일로 분리한 이유: index.ts가 registry를 export하기 전에
 * 하위 variant 파일이 registerVariants를 호출하면 TDZ 에러 발생.
 */
// Phase A
import './hero'
import './cta'
import './stats'

// Phase B
import './testimonials'
import './logos'
import './faq'

// Phase C
import './impact'
import './timeline'
import './gallery'
