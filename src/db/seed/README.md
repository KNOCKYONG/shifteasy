# 직원 데이터 업데이트

실제 근무표에서 추출한 간호사 명단으로 데이터베이스를 업데이트합니다.

## 직원 구성 (총 35명)

### 관리자
- **Unit Manager** (1명): 박선미

### Float RN (FRN)
- **FRN** (2명): 이다운, 이경은

### 일반 간호사 (RN)
- **시니어 (SENIOR)** - 5명: DL/EL 가능, 경력 5년 이상
- **주니어 (JUNIOR)** - 10명: 경력 2-5년
- **신입 (NEWBIE)** - 17명: 경력 2년 미만

## 실행 방법

```bash
# 직원 데이터 업데이트
npm run db:update-staff
```

## 데이터 구조

### 역할 (Role)
- `CN` (Charge Nurse): 수간호사 (Unit Manager)
- `SN` (Senior Nurse): 시니어 간호사 (FRN)
- `RN` (Registered Nurse): 일반 간호사

### 경력 레벨 (Experience Level)
- `EXPERT`: 전문가 (10년 이상)
- `SENIOR`: 시니어 (5년 이상)
- `JUNIOR`: 주니어 (2-5년)
- `NEWBIE`: 신입 (2년 미만)

### 역량 평가 (1-5 척도)
- `technicalSkill`: 기술적 역량
- `leadership`: 리더십
- `communication`: 의사소통
- `adaptability`: 적응력
- `reliability`: 신뢰성

## 주의사항

1. 이 스크립트는 기존 '내과간호2팀' 병동의 모든 직원 데이터를 삭제하고 새로 생성합니다.
2. 병동이 없으면 자동으로 생성됩니다.
3. 병원 데이터가 없으면 먼저 병원을 생성해야 합니다.