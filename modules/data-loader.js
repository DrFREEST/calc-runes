/**
 * ============================================
 * 데이터 로딩 모듈
 * ============================================
 * @file        modules/data-loader.js
 * @description 룬 JSON 데이터 로딩 및 초기화
 * @author      Dalkong Project
 * @created     2025-12-11
 * @modified    2025-12-11
 * @version     1.0.0
 * 
 * @architecture
 * - 전역 객체 패턴 (window.DataLoader)
 * - 비동기 데이터 로딩
 * 
 * @requires Utils
 */

(function() {
    'use strict';

    // ============================================
    // 1. 데이터 로딩 함수
    // ============================================

    /**
     * 룬 데이터 JSON 파일 로드
     * @async
     * @param {Function} [onSuccess] - 성공 콜백
     * @param {Function} [onError] - 실패 콜백
     * @returns {Promise<Array>} 전체 룬 배열
     */
    async function loadRuneData(onSuccess, onError) {
        try {
            // 4개의 분리된 JSON 파일 병렬 로드
            const [weaponRes, armorRes, accessoryRes, emblemRes] = await Promise.all([
                fetch('runes-weapon.json'),
                fetch('runes-armor.json'),
                fetch('runes-accessory.json'),
                fetch('runes-emblem.json')
            ]);

            // 응답 확인
            if (!weaponRes.ok) throw new Error('무기 룬 로드 실패: ' + weaponRes.status);
            if (!armorRes.ok) throw new Error('방어구 룬 로드 실패: ' + armorRes.status);
            if (!accessoryRes.ok) throw new Error('장신구 룬 로드 실패: ' + accessoryRes.status);
            if (!emblemRes.ok) throw new Error('엠블럼 룬 로드 실패: ' + emblemRes.status);

            // JSON 파싱
            const weaponData = await weaponRes.json();
            const armorData = await armorRes.json();
            const accessoryData = await accessoryRes.json();
            const emblemData = await emblemRes.json();

            // 무기 룬은 { runes: [...] } 형태, 나머지는 배열
            const weaponRunes = weaponData.runes || weaponData;
            const armorRunes = armorData;
            const accessoryRunes = accessoryData;
            const emblemRunes = emblemData;

            // 전체 룬 병합
            const allRunes = [
                ...weaponRunes,
                ...armorRunes,
                ...accessoryRunes,
                ...emblemRunes
            ];

            // 통계 출력
            const stats = {
                total: allRunes.length,
                byCategory: {
                    '무기': weaponRunes.length,
                    '방어구': armorRunes.length,
                    '장신구': accessoryRunes.length,
                    '엠블럼': emblemRunes.length
                },
                byGrade: {}
            };

            // 등급별 통계
            allRunes.forEach(function(rune) {
                const gradeName = rune.gradeName || '기타';
                stats.byGrade[gradeName] = (stats.byGrade[gradeName] || 0) + 1;
            });

            console.log('✅ 룬 데이터 로드 완료: 총 ' + allRunes.length + '개');
            console.log('📊 카테고리별 룬 수:', stats.byCategory);
            console.log('📊 등급별 룬 수:', stats.byGrade);

            if (onSuccess) {
                onSuccess(allRunes, stats);
            }

            return allRunes;

        } catch (error) {
            console.error('❌ 룬 데이터 로드 실패:', error);
            
            if (onError) {
                onError(error);
            }

            throw error;
        }
    }

    /**
     * 단일 JSON 파일 로드
     * @async
     * @param {string} url - JSON 파일 URL
     * @returns {Promise<*>} 파싱된 데이터
     */
    async function loadJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('JSON 로드 실패: ' + url + ' (' + response.status + ')');
        }
        return response.json();
    }

    // ============================================
    // 2. 데이터 검증 함수
    // ============================================

    /**
     * 룬 데이터 유효성 검증
     * @param {Object} rune - 룬 데이터
     * @returns {boolean} 유효 여부
     */
    function validateRune(rune) {
        if (!rune) return false;
        if (!rune.id || !rune.name) return false;
        if (!rune.category) return false;
        return true;
    }

    /**
     * 룬 배열 필터링 (유효한 것만)
     * @param {Array} runes - 룬 배열
     * @returns {Array} 유효한 룬 배열
     */
    function filterValidRunes(runes) {
        return runes.filter(validateRune);
    }

    // ============================================
    // 전역 객체 등록
    // ============================================

    /**
     * DataLoader 전역 객체
     * @global
     */
    window.DataLoader = {
        loadRuneData: loadRuneData,
        loadJSON: loadJSON,
        validateRune: validateRune,
        filterValidRunes: filterValidRunes
    };

    console.log('✅ DataLoader 모듈 로드 완료');

})();
