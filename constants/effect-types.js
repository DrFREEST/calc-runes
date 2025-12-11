/**
 * ============================================
 * 효과 유형 상수 모듈
 * ============================================
 * @file        constants/effect-types.js
 * @description 룬 효과 유형 및 가중치 상수 정의
 * @author      Dalkong Project
 * @created     2025-12-11
 * @modified    2025-12-11
 * @version     1.0.0
 * 
 * @architecture
 * - 전역 객체 패턴 (window.EffectTypes)
 * - 효과 파싱 엔진에서 사용하는 상수 중앙 관리
 * 
 * @structure
 * 1. 효과 유형 상수
 * 2. 효과 유형별 가중치
 * 3. 엠블럼 관련 상수
 * 4. 카테고리/등급 상수
 */

(function() {
    'use strict';

    // ============================================
    // 1. 효과 유형 상수
    // ============================================

    /**
     * 효과 유형 코드
     * @constant {Object}
     * @description 룬 효과의 발동 조건에 따른 분류
     */
    const EFFECT_TYPE = {
        /** 상시 효과 - 항상 적용 (100%) */
        PASSIVE: 'passive',
        /** 트리거 효과 - 특정 조건 시 발동 (80%) */
        TRIGGER: 'trigger',
        /** 누적/축적 효과 - 스택 기반 (95%) */
        STACKING: 'stacking',
        /** 상태 조건 효과 - 특정 상태일 때 (70%) */
        STATE_CONDITION: 'state',
        /** 적 상태 조건 - 적의 상태 의존 (시너지 의존) */
        ENEMY_CONDITION: 'enemy',
        /** 강화 단계별 효과 - 강화 조건 충족 시 (100%) */
        ENHANCEMENT: 'enhance'
    };

    // ============================================
    // 2. 효과 유형별 가중치
    // ============================================

    /**
     * 효과 유형별 업타임 가중치
     * @constant {Object}
     * @description 효과가 실제로 적용되는 시간 비율을 추정
     */
    const EFFECT_TYPE_WEIGHT = {
        [EFFECT_TYPE.PASSIVE]: 1.0,         // 100% - 상시 적용
        [EFFECT_TYPE.TRIGGER]: 0.8,         // 80% - 대부분 발동
        [EFFECT_TYPE.STACKING]: 0.95,       // 95% - 쉽게 최대 중첩 유지
        [EFFECT_TYPE.STATE_CONDITION]: 0.7, // 70% - 조건부
        [EFFECT_TYPE.ENEMY_CONDITION]: 0.5, // 50% - 시너지 없을 때
        [EFFECT_TYPE.ENHANCEMENT]: 1.0      // 100% - 강화 조건 충족 시
    };

    // ============================================
    // 3. 엠블럼 관련 상수
    // ============================================

    /**
     * 엠블럼 각성 기본 쿨타임 (초)
     * @constant {number}
     */
    const EMBLEM_AWAKENING_BASE_COOLDOWN = 90;

    /**
     * 엠블럼 각성 기본 지속시간 (초)
     * @constant {number}
     */
    const EMBLEM_AWAKENING_DEFAULT_DURATION = 15;

    // ============================================
    // 4. 카테고리/등급 상수
    // ============================================

    /**
     * 카테고리 코드 매핑
     * @constant {Object}
     */
    const CATEGORY_MAP = {
        '01': '무기',
        '02': '방어구',
        '03': '장신구',
        '04': '엠블럼'
    };

    /**
     * 카테고리 코드 (역방향)
     * @constant {Object}
     */
    const CATEGORY_CODE = {
        '무기': '01',
        '방어구': '02',
        '장신구': '03',
        '엠블럼': '04'
    };

    /**
     * 등급 정보 매핑
     * @constant {Object}
     */
    const GRADE_MAP = {
        '신화': {
            name: '신화',
            color: '#FFD700',
            priority: 1
        },
        '전설(시즌1)': {
            name: '전설(시즌1)',
            color: '#FF8C00',
            priority: 2
        },
        '전설(시즌0)': {
            name: '전설(시즌0)',
            color: '#FF6B00',
            priority: 3
        },
        '유니크(시즌0)': {
            name: '유니크(시즌0)',
            color: '#A855F7',
            priority: 4
        }
    };

    /**
     * 슬롯 구성 정보
     * @constant {Object}
     */
    const SLOT_CONFIG = {
        'weapon-1': { category: '01', label: '무기' },
        'emblem-1': { category: '04', label: '엠블럼' },
        'accessory-1': { category: '03', label: '장신구 1' },
        'accessory-2': { category: '03', label: '장신구 2' },
        'accessory-3': { category: '03', label: '장신구 3' },
        'armor-1': { category: '02', label: '방어구 1' },
        'armor-2': { category: '02', label: '방어구 2' },
        'armor-3': { category: '02', label: '방어구 3' },
        'armor-4': { category: '02', label: '방어구 4' },
        'armor-5': { category: '02', label: '방어구 5' }
    };

    /**
     * 페이지당 아이템 수
     * @constant {number}
     */
    const ITEMS_PER_PAGE = 20;

    // ============================================
    // 전역 객체 등록
    // ============================================

    /**
     * EffectTypes 전역 객체
     * @global
     */
    window.EffectTypes = {
        // 효과 유형
        EFFECT_TYPE: EFFECT_TYPE,
        EFFECT_TYPE_WEIGHT: EFFECT_TYPE_WEIGHT,

        // 엠블럼 상수
        EMBLEM_AWAKENING_BASE_COOLDOWN: EMBLEM_AWAKENING_BASE_COOLDOWN,
        EMBLEM_AWAKENING_DEFAULT_DURATION: EMBLEM_AWAKENING_DEFAULT_DURATION,

        // 카테고리/등급
        CATEGORY_MAP: CATEGORY_MAP,
        CATEGORY_CODE: CATEGORY_CODE,
        GRADE_MAP: GRADE_MAP,

        // 슬롯 구성
        SLOT_CONFIG: SLOT_CONFIG,

        // 기타
        ITEMS_PER_PAGE: ITEMS_PER_PAGE
    };

    console.log('✅ EffectTypes 상수 모듈 로드 완료');

})();
