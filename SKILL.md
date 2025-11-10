# Database Migration Skill

## 목적
`npm run db:push`를 실행할 때 Drizzle의 대화형 확인 없이 자동으로 완료되도록, 모든 컬럼 추가·제약 변경을 전처리 스크립트로 처리한다.

## 절차
1. **전처리 스크립트 추가**  
   - `scripts/prepare-*.ts` 를 만들어 해당 테이블에 nullable 컬럼을 추가하고, 필요한 값을 백필한 뒤 NOT NULL / FK / 인덱스를 적용한다.  
   - 환경 변수는 `.env.local`을 사용하고, `postgres` + `drizzle-orm` 조합으로 직접 SQL을 실행한다.

2. **db:push에 연결**  
   - `package.json`의 `db:push` 스크립트는 항상 `tsx scripts/prepare-*.ts && drizzle-kit push` 형태로 유지한다.  
   - 새 전처리 스크립트가 필요하면 체이닝해서 실행 순서를 명시한다.

3. **Drizzle 변경**  
   - 전처리가 끝난 뒤에야 스키마 파일을 수정하고 `npm run db:push`를 실행한다.  
   - Drizzle가 데이터 손실 경고를 띄우면 전처리 단계가 누락된 것이므로 스크립트를 보완한다.

## 체크리스트
- [ ] nullable → 데이터 백필 → NOT NULL/FK/인덱스 순서를 지켰는가?
- [ ] 준비 스크립트를 `db:push`에 포함했는가?
- [ ] `npm run db:push` 실행 시 사용자 입력이 전혀 필요 없는가?
