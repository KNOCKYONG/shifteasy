#!/usr/bin/env python3
import pandas as pd
import numpy as np
from collections import defaultdict, Counter
import json
import sys
import os

def analyze_roster_patterns():
    """실제 근무표에서 패턴과 규칙을 분석"""

    # 모든 엑셀 파일 읽기
    all_schedules = []
    nurses_shifts = defaultdict(list)  # 간호사별 근무 패턴
    shift_patterns = []  # 전체 근무 패턴

    for month in range(1, 10):
        try:
            df = pd.read_excel(f'/Users/nohdol/Downloads/{month}.xls', header=None)

            # 날짜 행 찾기 (보통 3번째 행)
            date_row = 2
            dates = df.iloc[date_row, 3:34].values  # 최대 31일

            # 직원 데이터 시작 행 찾기
            start_row = None
            for i in range(3, len(df)):
                if pd.notna(df.iloc[i, 0]) and '박선미' in str(df.iloc[i, 1]):
                    start_row = i
                    break

            if start_row:
                month_data = {}
                for i in range(start_row, len(df)):
                    if pd.isna(df.iloc[i, 1]):
                        break

                    name = str(df.iloc[i, 1]).strip()
                    if name and '합계' not in name:
                        shifts = []
                        for j in range(3, min(34, 3 + len(dates))):
                            shift = df.iloc[i, j]
                            if pd.notna(shift):
                                shift_str = str(shift).strip()
                                shifts.append(shift_str)
                                nurses_shifts[name].append(shift_str)

                        month_data[name] = shifts

                all_schedules.append({
                    'month': month,
                    'data': month_data
                })

        except Exception as e:
            print(f"Error reading month {month}: {e}")
            continue

    # 분석 결과
    analysis = {
        'nurses': {},
        'patterns': {},
        'rules': {},
        'statistics': {}
    }

    # 1. 간호사별 근무 패턴 분석
    for nurse, shifts in nurses_shifts.items():
        shift_counts = Counter(shifts)
        analysis['nurses'][nurse] = {
            'total_shifts': len(shifts),
            'shift_distribution': dict(shift_counts),
            'most_common': shift_counts.most_common(3)
        }

    # 2. 근무 패턴 분석
    shift_sequences = defaultdict(int)
    consecutive_patterns = defaultdict(int)

    for nurse, shifts in nurses_shifts.items():
        # 연속 근무 패턴
        for i in range(len(shifts) - 1):
            pattern = f"{shifts[i]}→{shifts[i+1]}"
            shift_sequences[pattern] += 1

        # 연속 근무 일수
        consecutive_count = 1
        for i in range(1, len(shifts)):
            if shifts[i] != 'OFF' and shifts[i-1] != 'OFF':
                consecutive_count += 1
            else:
                if consecutive_count > 1:
                    consecutive_patterns[consecutive_count] += 1
                consecutive_count = 1 if shifts[i] != 'OFF' else 0

    analysis['patterns'] = {
        'shift_transitions': dict(sorted(shift_sequences.items(), key=lambda x: x[1], reverse=True)[:20]),
        'consecutive_days': dict(consecutive_patterns)
    }

    # 3. 규칙 추출
    rules = {
        'hard_constraints': [],
        'soft_constraints': [],
        'discovered_patterns': []
    }

    # 하드 규칙 발견
    max_consecutive = max(consecutive_patterns.keys()) if consecutive_patterns else 0
    if max_consecutive <= 6:
        rules['hard_constraints'].append(f"최대 연속 근무: {max_consecutive}일")

    # Night → Day 전환 패턴 확인
    night_to_day = shift_sequences.get('N→D', 0)
    if night_to_day == 0:
        rules['hard_constraints'].append("Night 근무 후 Day 근무 없음")

    # Evening → Day 전환 패턴
    evening_to_day = shift_sequences.get('E→D', 0)
    if evening_to_day < 5:  # 거의 없음
        rules['soft_constraints'].append("Evening 후 Day 근무 최소화")

    # 리더 역할 패턴
    leader_patterns = []
    for pattern, count in shift_sequences.items():
        if 'DL' in pattern or 'EL' in pattern:
            leader_patterns.append((pattern, count))

    if leader_patterns:
        rules['discovered_patterns'].append({
            'type': 'leader_rotation',
            'patterns': leader_patterns[:10]
        })

    analysis['rules'] = rules

    # 4. 통계 분석
    total_shifts = sum(len(shifts) for shifts in nurses_shifts.values())
    unique_shifts = set()
    for shifts in nurses_shifts.values():
        unique_shifts.update(shifts)

    shift_type_counts = Counter()
    for shifts in nurses_shifts.values():
        shift_type_counts.update(shifts)

    analysis['statistics'] = {
        'total_nurses': len(nurses_shifts),
        'total_shifts': total_shifts,
        'unique_shift_types': list(unique_shifts),
        'shift_distribution': dict(shift_type_counts),
        'months_analyzed': len(all_schedules)
    }

    # 5. 일별 필요 인원 분석
    daily_coverage = defaultdict(lambda: defaultdict(int))

    for schedule in all_schedules:
        month_data = schedule['data']
        # 각 날짜별로 근무 유형별 인원 계산
        for day_idx in range(31):  # 최대 31일
            day_shifts = defaultdict(int)
            for nurse, shifts in month_data.items():
                if day_idx < len(shifts):
                    shift = shifts[day_idx]
                    if shift != 'OFF':
                        # 근무 유형 정규화
                        if shift in ['D', 'DL', '11D']:
                            day_shifts['day'] += 1
                        elif shift in ['E', 'EL']:
                            day_shifts['evening'] += 1
                        elif shift == 'N':
                            day_shifts['night'] += 1

            for shift_type, count in day_shifts.items():
                daily_coverage[shift_type][count] += 1

    # 평균 필요 인원 계산
    coverage_stats = {}
    for shift_type, counts in daily_coverage.items():
        total = sum(counts.values())
        if total > 0:
            weighted_sum = sum(people * freq for people, freq in counts.items())
            coverage_stats[shift_type] = {
                'average': round(weighted_sum / total, 1),
                'min': min(counts.keys()),
                'max': max(counts.keys()),
                'distribution': dict(counts)
            }

    analysis['coverage_requirements'] = coverage_stats

    return analysis

def generate_improvement_recommendations(analysis):
    """분석 결과를 바탕으로 개선 제안"""

    recommendations = {
        'scheduling_algorithm': [],
        'constraint_optimization': [],
        'fairness_improvements': [],
        'implementation_priority': []
    }

    # 1. 스케줄링 알고리즘 개선
    recommendations['scheduling_algorithm'] = [
        {
            'title': 'Pattern-Based Scheduling',
            'description': '실제 데이터에서 발견된 shift transition 패턴을 활용',
            'details': [
                f"자주 발생하는 패턴: {list(analysis['patterns']['shift_transitions'].items())[:5]}",
                "이러한 패턴을 우선적으로 적용하여 자연스러운 스케줄 생성"
            ]
        },
        {
            'title': 'Coverage-Driven Assignment',
            'description': '일별 필요 인원을 기반으로 한 할당',
            'details': [
                f"Day shift: 평균 {analysis['coverage_requirements'].get('day', {}).get('average', 0)}명",
                f"Evening shift: 평균 {analysis['coverage_requirements'].get('evening', {}).get('average', 0)}명",
                f"Night shift: 평균 {analysis['coverage_requirements'].get('night', {}).get('average', 0)}명"
            ]
        }
    ]

    # 2. 제약 조건 최적화
    recommendations['constraint_optimization'] = [
        {
            'constraint': 'Max Consecutive Days',
            'current': analysis['patterns']['consecutive_days'],
            'recommendation': '최대 5일 연속 근무 제한'
        },
        {
            'constraint': 'Shift Transitions',
            'forbidden': ['N→D', 'E→D (minimize)'],
            'preferred': ['D→E', 'E→N', 'N→OFF']
        }
    ]

    # 3. 공정성 개선
    nurse_workloads = {}
    for nurse, data in analysis['nurses'].items():
        total = data['total_shifts']
        offs = data['shift_distribution'].get('OFF', 0)
        nurse_workloads[nurse] = total - offs

    avg_workload = np.mean(list(nurse_workloads.values()))
    std_workload = np.std(list(nurse_workloads.values()))

    recommendations['fairness_improvements'] = [
        {
            'metric': 'Workload Distribution',
            'current_std': round(std_workload, 2),
            'target': 'Reduce standard deviation by 30%',
            'method': 'Implement workload balancing algorithm'
        },
        {
            'metric': 'Shift Type Distribution',
            'issue': 'Some nurses have uneven D/E/N distribution',
            'solution': 'Rotate shift types fairly among qualified staff'
        }
    ]

    # 4. 구현 우선순위
    recommendations['implementation_priority'] = [
        {
            'priority': 1,
            'feature': 'Hard Constraint Enforcement',
            'description': '필수 규칙 (연속 근무 제한, 휴식 시간) 자동 적용',
            'effort': 'Medium'
        },
        {
            'priority': 2,
            'feature': 'Pattern-Based Generation',
            'description': '실제 패턴을 학습한 스케줄 생성 알고리즘',
            'effort': 'High'
        },
        {
            'priority': 3,
            'feature': 'Fairness Optimization',
            'description': '근무 부담 균등 분배 시스템',
            'effort': 'Medium'
        },
        {
            'priority': 4,
            'feature': 'Preference Management',
            'description': '개인 선호도 반영 시스템',
            'effort': 'Low'
        }
    ]

    return recommendations

# 실행
if __name__ == "__main__":
    print("📊 실제 근무표 분석 시작...\n")

    analysis = analyze_roster_patterns()

    print("=" * 60)
    print("📋 분석 결과")
    print("=" * 60)

    # 통계 출력
    stats = analysis['statistics']
    print(f"\n📈 기본 통계:")
    print(f"  - 분석 기간: {stats['months_analyzed']}개월")
    print(f"  - 총 간호사: {stats['total_nurses']}명")
    print(f"  - 근무 유형: {', '.join(stats['unique_shift_types'])}")

    # 패턴 출력
    print(f"\n🔄 주요 근무 전환 패턴 (상위 10개):")
    for pattern, count in list(analysis['patterns']['shift_transitions'].items())[:10]:
        print(f"  - {pattern}: {count}회")

    # 연속 근무 패턴
    print(f"\n📅 연속 근무 일수 분포:")
    for days, count in sorted(analysis['patterns']['consecutive_days'].items()):
        print(f"  - {days}일 연속: {count}회")

    # 규칙 출력
    print(f"\n📏 발견된 규칙:")
    rules = analysis['rules']
    print("  하드 제약:")
    for rule in rules['hard_constraints']:
        print(f"    - {rule}")
    print("  소프트 제약:")
    for rule in rules['soft_constraints']:
        print(f"    - {rule}")

    # 필요 인원 분석
    print(f"\n👥 일별 필요 인원:")
    for shift_type, stats in analysis['coverage_requirements'].items():
        print(f"  - {shift_type}: 평균 {stats['average']}명 (최소 {stats['min']}, 최대 {stats['max']})")

    print("\n" + "=" * 60)
    print("💡 개선 제안")
    print("=" * 60)

    recommendations = generate_improvement_recommendations(analysis)

    # 알고리즘 개선
    print("\n🔧 스케줄링 알고리즘 개선:")
    for rec in recommendations['scheduling_algorithm']:
        print(f"  [{rec['title']}]")
        print(f"    {rec['description']}")
        for detail in rec['details']:
            print(f"      • {detail}")

    # 구현 우선순위
    print("\n🎯 구현 우선순위:")
    for item in recommendations['implementation_priority']:
        print(f"  {item['priority']}. {item['feature']} (난이도: {item['effort']})")
        print(f"     → {item['description']}")

    # JSON으로 저장
    output = {
        'analysis': analysis,
        'recommendations': recommendations
    }

    with open('/Users/nohdol/project/web_project/shifteasy/scripts/roster_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2, default=str)

    print("\n✅ 분석 완료! 결과가 roster_analysis.json에 저장되었습니다.")