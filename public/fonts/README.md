# public/fonts

PDF 영수증 생성(`src/lib/receipt/pdf.ts`)이 한글 렌더링을 위해 이 디렉토리의 TTF 폰트를
필요로 한다. 파일 크기가 커서 git 에는 포함하지 않으므로(`.gitignore` 참고) 로컬/배포
환경에서 각자 배치한다.

## 필요한 파일

- `NotoSansKR-Regular.ttf` (약 6MB)
- `NotoSansKR-Bold.ttf` (약 6MB)

두 파일이 모두 없으면 `/api/admin/receipts/[memberId]` 는 500 과 함께 명시적인 에러
메시지를 반환한다(크래시하지 않음).

## 다운로드 방법

### 옵션 1 — `@expo-google-fonts/noto-sans-kr` (jsdelivr CDN, 검증됨)

```bash
mkdir -p public/fonts
curl -L -o public/fonts/NotoSansKR-Regular.ttf \
  "https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-kr@0.4.3/400Regular/NotoSansKR_400Regular.ttf"
curl -L -o public/fonts/NotoSansKR-Bold.ttf \
  "https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-kr@0.4.3/700Bold/NotoSansKR_700Bold.ttf"
```

### 옵션 2 — Google Fonts 수동 다운로드

1. <https://fonts.google.com/noto/specimen/Noto+Sans+KR>
2. "Get font" → "Download all" → ZIP 해제
3. `NotoSansKR-Regular.ttf`, `NotoSansKR-Bold.ttf` 를 이 디렉토리에 복사

### 옵션 3 — `@expo-google-fonts/noto-sans-kr` npm 패키지 설치

```bash
npm install --no-save @expo-google-fonts/noto-sans-kr
cp node_modules/@expo-google-fonts/noto-sans-kr/400Regular/NotoSansKR_400Regular.ttf \
   public/fonts/NotoSansKR-Regular.ttf
cp node_modules/@expo-google-fonts/noto-sans-kr/700Bold/NotoSansKR_700Bold.ttf \
   public/fonts/NotoSansKR-Bold.ttf
```

## 확인

```bash
file public/fonts/NotoSansKR-Regular.ttf
# → TrueType Font data, ... Microsoft, language 0x409
ls -la public/fonts/*.ttf
# → 각각 약 6MB
```

## 라이선스

Noto Sans KR 는 SIL Open Font License 1.1 하에 배포된다. 상세: <https://openfontlicense.org/>.
