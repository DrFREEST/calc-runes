/**
 * ============================================================================
 * 마비노기 모바일 룬 효율 계산기 - 클래스별 스텟 상수
 * ============================================================================
 * @file class-stats.js
 * @description 클래스별 메인/서브 스텟 매핑 및 관련 상수 정의
 * @author AI Assistant
 * @created 2025-12-11
 * 
 * @architecture
 * - CLASS_STATS: 18개 세부 클래스의 메인/서브 스텟 정의
 * - CLASS_CATEGORIES: 6개 클래스 계열 그룹핑
 * - STAT_EFFECTS: 5대 기본 스텟이 영향을 주는 보조 스텟 정의
 * ============================================================================
 */

'use strict';

// ============================================================================
// 섹션 1: 5대 기본 스텟 → 보조 스텟 매핑
// ============================================================================

/**
 * 5대 기본 스텟이 영향을 주는 보조 스텟 정의
 * 출처: 게임 내 스텟 정보 화면
 * 
 * @constant {Object}
 */
const STAT_EFFECTS = Object.freeze({
    /** 힘 스텟이 영향을 주는 보조 스텟 */
    STRENGTH: {
        name: '힘',
        effects: ['브레이크', '피해감소', '강타강화']
    },

    /** 솜씨 스텟이 영향을 주는 보조 스텟 */
    DEXTERITY: {
        name: '솜씨',
        effects: ['빠른공격', '콤보강화', '연타강화']
    },

    /** 지력 스텟이 영향을 주는 보조 스텟 */
    INTELLIGENCE: {
        name: '지력',
        effects: ['스킬위력', '빠른스킬', '광역강화']
    },

    /** 행운 스텟이 영향을 주는 보조 스텟 */
    LUCK: {
        name: '행운',
        effects: ['급소회피', '치명타', '추가타']
    },

    /** 의지 스텟이 영향을 주는 보조 스텟 */
    WILL: {
        name: '의지',
        effects: ['추가체력', '회복력', '궁극기']
    }
});

// ============================================================================
// 섹션 2: 클래스 계열 정의
// ============================================================================

/**
 * 6개 클래스 계열과 소속 세부 클래스
 * 
 * @constant {Object}
 */
const CLASS_CATEGORIES = Object.freeze({
    /** 전사 계열 */
    WARRIOR: {
        name: '전사계열',
        classes: ['전사', '대검전사', '검술사']
    },

    /** 궁수 계열 */
    ARCHER: {
        name: '궁수계열',
        classes: ['궁수', '석궁사수', '장궁병']
    },

    /** 마법사 계열 */
    MAGE: {
        name: '마법사계열',
        classes: ['마법사', '화염술사', '빙결술사', '전격술사']
    },

    /** 힐러 계열 */
    HEALER: {
        name: '힐러계열',
        classes: ['힐러', '사제', '수도사', '암흑술사']
    },

    /** 도적 계열 */
    ROGUE: {
        name: '도적계열',
        classes: ['도적', '격투가', '듀얼블레이드']
    },

    /** 음유시인 계열 */
    BARD: {
        name: '음유시인계열',
        classes: ['음유시인', '댄서', '악사']
    }
});

// ============================================================================
// 섹션 3: 세부 클래스별 메인/서브 스텟 정의
// ============================================================================

/**
 * 18개 세부 클래스의 메인/서브 스텟 정의
 * 
 * @constant {Object}
 * @property {string} main - 메인 스텟 (STRENGTH, DEXTERITY, INTELLIGENCE)
 * @property {string|null} sub - 서브 스텟 (LUCK, WILL, null)
 * @property {string} category - 소속 계열
 * @property {Array<string>} priorityEffects - 우선 추천 효과 (Sub 스텟 기반)
 */
const CLASS_STATS = Object.freeze({
    // ========== 전사 계열 ==========
    '전사': {
        main: 'STRENGTH',
        sub: null,
        category: 'WARRIOR',
        priorityEffects: ['강타피해']
    },
    '대검전사': {
        main: 'STRENGTH',
        sub: 'WILL',
        category: 'WARRIOR',
        priorityEffects: ['강타피해', '궁극기']
    },
    '검술사': {
        main: 'STRENGTH',
        sub: 'LUCK',
        category: 'WARRIOR',
        priorityEffects: ['치명타', '추가타']
    },

    // ========== 궁수 계열 ==========
    '궁수': {
        main: 'DEXTERITY',
        sub: null,
        category: 'ARCHER',
        priorityEffects: ['연타피해', '콤보피해']
    },
    '석궁사수': {
        main: 'DEXTERITY',
        sub: 'LUCK',
        category: 'ARCHER',
        priorityEffects: ['치명타', '추가타']
    },
    '장궁병': {
        main: 'DEXTERITY',
        sub: 'WILL',
        category: 'ARCHER',
        priorityEffects: ['연타피해', '궁극기']
    },

    // ========== 마법사 계열 ==========
    '마법사': {
        main: 'INTELLIGENCE',
        sub: null,
        category: 'MAGE',
        priorityEffects: ['스킬피해', '광역피해']
    },
    '화염술사': {
        main: 'INTELLIGENCE',
        sub: 'LUCK',
        category: 'MAGE',
        priorityEffects: ['치명타', '추가타', '스킬피해']
    },
    '빙결술사': {
        main: 'INTELLIGENCE',
        sub: 'WILL',
        category: 'MAGE',
        priorityEffects: ['스킬피해', '궁극기']
    },
    '전격술사': {
        main: 'INTELLIGENCE',
        sub: 'LUCK',
        category: 'MAGE',
        priorityEffects: ['치명타', '추가타', '스킬피해']
    },

    // ========== 힐러 계열 ==========
    '힐러': {
        main: 'INTELLIGENCE',
        sub: null,
        category: 'HEALER',
        priorityEffects: ['스킬피해', '회복력']
    },
    '사제': {
        main: 'INTELLIGENCE',
        sub: 'WILL',
        category: 'HEALER',
        priorityEffects: ['회복력', '궁극기']
    },
    '수도사': {
        main: 'INTELLIGENCE',
        sub: 'WILL',
        category: 'HEALER',
        priorityEffects: ['스킬피해', '궁극기']
    },
    '암흑술사': {
        main: 'INTELLIGENCE',
        sub: 'LUCK',
        category: 'HEALER',
        priorityEffects: ['치명타', '추가타', '스킬피해']
    },

    // ========== 도적 계열 ==========
    '도적': {
        main: 'DEXTERITY',
        sub: null,
        category: 'ROGUE',
        priorityEffects: ['연타피해', '콤보피해']
    },
    '격투가': {
        main: 'DEXTERITY',
        sub: 'WILL',
        category: 'ROGUE',
        priorityEffects: ['연타피해', '궁극기']
    },
    '듀얼블레이드': {
        main: 'DEXTERITY',
        sub: 'LUCK',
        category: 'ROGUE',
        priorityEffects: ['치명타', '추가타', '연타피해']
    },

    // ========== 음유시인 계열 ==========
    '음유시인': {
        main: 'DEXTERITY',
        sub: null,
        category: 'BARD',
        priorityEffects: ['콤보피해', '연타피해']
    },
    '댄서': {
        main: 'DEXTERITY',
        sub: 'LUCK',
        category: 'BARD',
        priorityEffects: ['치명타', '추가타']
    },
    '악사': {
        main: 'DEXTERITY',
        sub: 'WILL',
        category: 'BARD',
        priorityEffects: ['회복력', '궁극기']
    }
});

// ============================================================================
// 섹션 4: 헬퍼 함수
// ============================================================================

/**
 * 클래스명으로 스텟 정보 조회
 * 
 * @param {string} className - 클래스명 (예: '검술사')
 * @returns {Object|null} 클래스 스텟 정보 또는 null
 * 
 * @example
 * const stats = getClassStats('검술사');
 * // { main: 'STRENGTH', sub: 'LUCK', category: 'WARRIOR', priorityEffects: [...] }
 */
function getClassStats(className) {
    return CLASS_STATS[className] || null;
}

/**
 * 클래스의 Sub 스텟이 영향을 주는 효과 목록 조회
 * 
 * @param {string} className - 클래스명
 * @returns {Array<string>} Sub 스텟 관련 효과 목록
 * 
 * @example
 * const effects = getSubStatEffects('검술사');
 * // ['급소회피', '치명타', '추가타']
 */
function getSubStatEffects(className) {
    const classInfo = CLASS_STATS[className];
    if (!classInfo || !classInfo.sub) {
        return [];
    }
    return STAT_EFFECTS[classInfo.sub].effects;
}

/**
 * 클래스 계열 조회
 * 
 * @param {string} className - 클래스명
 * @returns {string|null} 계열명 또는 null
 * 
 * @example
 * const category = getClassCategory('검술사');
 * // 'WARRIOR'
 */
function getClassCategory(className) {
    const classInfo = CLASS_STATS[className];
    return classInfo ? classInfo.category : null;
}

/**
 * 모든 클래스명 목록 조회
 * 
 * @returns {Array<string>} 클래스명 배열
 */
function getAllClassNames() {
    return Object.keys(CLASS_STATS);
}

/**
 * 계열별 클래스 목록 조회
 * 
 * @param {string} categoryKey - 계열 키 (예: 'WARRIOR')
 * @returns {Array<string>} 클래스명 배열
 */
function getClassesByCategory(categoryKey) {
    const category = CLASS_CATEGORIES[categoryKey];
    return category ? category.classes : [];
}

// ============================================================================
// 섹션 5: 모듈 내보내기
// ============================================================================

// ES6 모듈 환경
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STAT_EFFECTS,
        CLASS_CATEGORIES,
        CLASS_STATS,
        getClassStats,
        getSubStatEffects,
        getClassCategory,
        getAllClassNames,
        getClassesByCategory
    };
}

// 브라우저 환경 - 전역 객체에 등록
if (typeof window !== 'undefined') {
    window.ClassStats = {
        STAT_EFFECTS,
        CLASS_CATEGORIES,
        CLASS_STATS,
        getClassStats,
        getSubStatEffects,
        getClassCategory,
        getAllClassNames,
        getClassesByCategory
    };
}