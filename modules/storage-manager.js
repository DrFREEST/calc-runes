/**
 * ============================================
 * LocalStorage 관리 모듈
 * ============================================
 * @file        modules/storage-manager.js
 * @description LocalStorage 데이터 저장/불러오기 유틸리티
 * @author      Dalkong Project
 * @created     2025-12-11
 * @modified    2025-12-11
 * @version     1.0.0
 * 
 * @architecture
 * - 전역 객체 패턴 (window.StorageManager)
 * - 모든 LocalStorage 작업을 중앙 집중화
 * 
 * @structure
 * 1. 상수 정의 (Storage Keys)
 * 2. 저장/불러오기 함수
 * 3. 데이터 검증 함수
 */

(function() {
    'use strict';

    // ============================================
    // 1. 상수 정의 (Storage Keys)
    // ============================================

    /**
     * LocalStorage 키 상수
     * @constant {Object}
     * @description 모든 LocalStorage 키를 중앙 관리
     */
    const STORAGE_KEYS = {
        /** 즐겨찾기한 룬 ID 목록 */
        FAVORITES: 'mabinogi_rune_favorites',
        /** 저장된 프리셋 목록 */
        PRESETS: 'mabinogi_rune_presets',
        /** 장착된 룬 정보 */
        EQUIPPED_RUNES: 'mabinogi_rune_equipped',
        /** 캐릭터 스탯 정보 */
        CHARACTER_STATS: 'mabinogi_rune_character_stats',
        /** 추천 옵션 설정 */
        RECOMMEND_OPTIONS: 'mabinogi_rune_recommend_options',
        /** 강화 수치 정보 */
        ENHANCE_LEVELS: 'mabinogi_rune_enhance_levels',
        /** 캐릭터 프로필 목록 @added 2025-12-11 */
        CHARACTER_PROFILES: 'mabinogi_rune_character_profiles',
        /** 현재 선택된 캐릭터 @added 2025-12-11 */
        CURRENT_CHARACTER: 'mabinogi_rune_current_character'
    };

    // ============================================
    // 2. 저장/불러오기 함수
    // ============================================

    /**
     * LocalStorage에서 데이터 로드
     * @param {string} key - 저장소 키
     * @param {*} defaultValue - 기본값 (데이터가 없거나 오류 시 반환)
     * @returns {*} 저장된 데이터 또는 기본값
     */
    function loadFromStorage(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            if (data === null) {
                return defaultValue;
            }
            return JSON.parse(data);
        } catch (e) {
            console.error('[StorageManager] 로드 오류:', key, e);
            return defaultValue;
        }
    }

    /**
     * LocalStorage에 데이터 저장
     * @param {string} key - 저장소 키
     * @param {*} value - 저장할 데이터 (JSON 직렬화 가능해야 함)
     * @returns {boolean} 저장 성공 여부
     */
    function saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('[StorageManager] 저장 오류:', key, e);
            // 용량 초과 시 경고
            if (e.name === 'QuotaExceededError') {
                console.warn('[StorageManager] LocalStorage 용량 초과!');
            }
            return false;
        }
    }

    /**
     * LocalStorage에서 데이터 삭제
     * @param {string} key - 삭제할 저장소 키
     * @returns {boolean} 삭제 성공 여부
     */
    function removeFromStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('[StorageManager] 삭제 오류:', key, e);
            return false;
        }
    }

    /**
     * 특정 키의 데이터 존재 여부 확인
     * @param {string} key - 저장소 키
     * @returns {boolean} 데이터 존재 여부
     */
    function hasData(key) {
        return localStorage.getItem(key) !== null;
    }

    // ============================================
    // 3. 데이터 검증 함수
    // ============================================

    /**
     * 저장된 데이터 무결성 검증
     * @param {string} key - 저장소 키
     * @returns {boolean} 데이터 유효성 여부
     */
    function validateData(key) {
        try {
            const data = localStorage.getItem(key);
            if (data === null) return true; // 데이터 없음은 유효
            JSON.parse(data);
            return true;
        } catch (e) {
            console.warn('[StorageManager] 손상된 데이터 감지:', key);
            return false;
        }
    }

    /**
     * 손상된 데이터 복구 (삭제)
     * @param {string} key - 저장소 키
     */
    function repairData(key) {
        if (!validateData(key)) {
            console.warn('[StorageManager] 손상된 데이터 삭제:', key);
            removeFromStorage(key);
        }
    }

    /**
     * 모든 앱 데이터 초기화
     * @description 모든 저장된 데이터를 삭제 (주의: 복구 불가)
     */
    function clearAllData() {
        Object.values(STORAGE_KEYS).forEach(function(key) {
            removeFromStorage(key);
        });
        console.log('[StorageManager] 모든 데이터 초기화 완료');
    }

    /**
     * 현재 사용 중인 저장소 용량 확인
     * @returns {Object} { used: number, total: number, percentage: number }
     */
    function getStorageUsage() {
        let totalSize = 0;
        
        Object.values(STORAGE_KEYS).forEach(function(key) {
            const data = localStorage.getItem(key);
            if (data) {
                totalSize += data.length * 2; // UTF-16 기준 (2 bytes per char)
            }
        });

        // 일반적인 LocalStorage 한도: 5MB
        const totalLimit = 5 * 1024 * 1024;
        
        return {
            used: totalSize,
            total: totalLimit,
            percentage: Math.round((totalSize / totalLimit) * 100)
        };
    }

    // ============================================
    // 전역 객체 등록
    // ============================================

    /**
     * StorageManager 전역 객체
     * @global
     */
    window.StorageManager = {
        // 상수
        KEYS: STORAGE_KEYS,
        
        // 기본 함수
        load: loadFromStorage,
        save: saveToStorage,
        remove: removeFromStorage,
        has: hasData,
        
        // 검증/유틸리티
        validate: validateData,
        repair: repairData,
        clearAll: clearAllData,
        getUsage: getStorageUsage
    };

    console.log('✅ StorageManager 모듈 로드 완료');

})();
