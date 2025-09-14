// 연차 정보 업데이트 스크립트
const fs = require('fs');

// 파일 읽기
let content = fs.readFileSync('src/lib/mock/team-members.ts', 'utf8');

// 각 직원별 연차 정보 (emp-012부터 emp-025까지)
const experienceData = [
  { id: 'emp-012', years: 2, level: 'junior' },
  { id: 'emp-013', years: 5, level: 'senior' },
  { id: 'emp-014', years: 6, level: 'senior' },
  { id: 'emp-015', years: 10, level: 'expert' },
  { id: 'emp-016', years: 3, level: 'intermediate' },
  { id: 'emp-017', years: 1, level: 'junior' },
  { id: 'emp-018', years: 4, level: 'intermediate' },
  { id: 'emp-019', years: 1, level: 'junior' },
  { id: 'emp-020', years: 20, level: 'expert' },
  { id: 'emp-021', years: 1, level: 'junior' },
  { id: 'emp-022', years: 1, level: 'junior' },
  { id: 'emp-023', years: 2, level: 'junior' },
  { id: 'emp-024', years: 1, level: 'junior' },
  { id: 'emp-025', years: 2, level: 'junior' },
];

// 각 직원에 대해 연차 정보 추가
experienceData.forEach(emp => {
  const regex = new RegExp(`(id: '${emp.id}',[\\s\\S]*?skills: \\[[^\\]]+\\],)`, 'g');
  content = content.replace(regex, `$1\n    experienceYears: ${emp.years},\n    seniorityLevel: '${emp.level}',`);
});

// 파일 저장
fs.writeFileSync('src/lib/mock/team-members.ts', content);
console.log('Experience data updated successfully!');