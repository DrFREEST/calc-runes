/**
 * ============================================
 * 유틸리티 함수 모듈
 * ============================================
 * @file        modules/utils.js
 * @description 공통 유틸리티 함수 모음
 * @author      Dalkong Project
 * @created     2025-12-11
 * @modified    2025-12-11
 * @version     1.0.0
 * 
 * @architecture
 * - 전역 객체 패턴 (window.Utils)
 * - 모든 모듈에서 공통으로 사용하는 함수
 * 
 * @structure
 * 1. DOM 헬퍼 함수
 * 2. 문자열 처리 함수
 * 3. 함수 유틸리티
 * 4. 숫자 유틸리티
 */

(function() {
    'use strict';

    // ============================================
    // 1. DOM 헬퍼 함수
    // ============================================

    /**
     * DOM 요소 선택 헬퍼 (단일)
     * @param {string} selector - CSS 선택자
     * @returns {Element|null} DOM 요소
     */
    function $(selector) {
        return document.querySelector(selector);
    }

    /**
     * 다중 DOM 요소 선택 헬퍼
     * @param {string} selector - CSS 선택자
     * @returns {NodeList} DOM 요소 목록
     */
    function $$(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * 요소 생성 헬퍼
     * @param {string} tag - 태그명
     * @param {Object} [attrs] - 속성 객체
     * @param {string} [content] - 내부 HTML
     * @returns {Element} 생성된 요소
     */
    function createElement(tag, attrs, content) {
        const el = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function(key) {
                if (key === 'className') {
                    el.className = attrs[key];
                } else if (key === 'dataset') {
                    Object.assign(el.dataset, attrs[key]);
                } else {
                    el.setAttribute(key, attrs[key]);
                }
            });
        }
        if (content) {
            el.innerHTML = content;
        }
        return el;
    }

    // ============================================
    // 2. 문자열 처리 함수
    // ============================================

    /**
     * HTML 특수문자 이스케이프
     * @param {string} text - 원본 텍스트
     * @returns {string} 이스케이프된 텍스트
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * HTML 태그 제거
     * @param {string} html - HTML 문자열
     * @returns {string} 태그가 제거된 텍스트
     */
    function stripHtml(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    /**
     * 문자열 자르기 (말줄임)
     * @param {string} str - 원본 문자열
     * @param {number} maxLength - 최대 길이
     * @param {string} [suffix='...'] - 말줄임 문자
     * @returns {string} 잘린 문자열
     */
    function truncate(str, maxLength, suffix) {
        suffix = suffix || '...';
        if (!str || str.length <= maxLength) return str;
        return str.substring(0, maxLength - suffix.length) + suffix;
    }

    // ============================================
    // 3. 함수 유틸리티
    // ============================================

    /**
     * 디바운스 함수
     * @param {Function} func - 실행할 함수
     * @param {number} wait - 대기 시간 (ms)
     * @returns {Function} 디바운스된 함수
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction() {
            const args = arguments;
            const context = this;
            const later = function() {
                clearTimeout(timeout);
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 쓰로틀 함수
     * @param {Function} func - 실행할 함수
     * @param {number} limit - 제한 시간 (ms)
     * @returns {Function} 쓰로틀된 함수
     */
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(function() {
                    inThrottle = false;
                }, limit);
            }
        };
    }

    // ============================================
    // 4. 숫자 유틸리티
    // ============================================

    /**
     * 숫자 포맷팅 (천 단위 콤마)
     * @param {number} num - 숫자
     * @returns {string} 포맷된 문자열
     */
    function formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return num.toLocaleString('ko-KR');
    }

    /**
     * 퍼센트 포맷팅
     * @param {number} value - 값
     * @param {number} [decimals=1] - 소수점 자리수
     * @returns {string} 포맷된 문자열
     */
    function formatPercent(value, decimals) {
        decimals = decimals !== undefined ? decimals : 1;
        if (value === null || value === undefined) return '0%';
        return value.toFixed(decimals) + '%';
    }

    /**
     * 값 범위 제한
     * @param {number} value - 값
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     * @returns {number} 제한된 값
     */
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * 안전한 정수 파싱
     * @param {*} value - 파싱할 값
     * @param {number} [defaultValue=0] - 기본값
     * @returns {number} 정수
     */
    function safeParseInt(value, defaultValue) {
        defaultValue = defaultValue !== undefined ? defaultValue : 0;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    /**
     * 안전한 실수 파싱
     * @param {*} value - 파싱할 값
     * @param {number} [defaultValue=0] - 기본값
     * @returns {number} 실수
     */
    function safeParseFloat(value, defaultValue) {
        defaultValue = defaultValue !== undefined ? defaultValue : 0;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    // ============================================
    // 5. 날짜 유틸리티
    // ============================================

    /**
     * 현재 날짜 문자열 반환
     * @returns {string} YYYY-MM-DD 형식
     */
    function getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * 현재 날짜시간 문자열 반환
     * @returns {string} YYYY-MM-DD HH:mm:ss 형식
     */
    function getCurrentDateTime() {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0];
        return date + ' ' + time;
    }

    // ============================================
    // 전역 객체 등록
    // ============================================

    /**
     * Utils 전역 객체
     * @global
     */
    window.Utils = {
        // DOM
        $: $,
        $$: $$,
        createElement: createElement,

        // 문자열
        escapeHtml: escapeHtml,
        stripHtml: stripHtml,
        truncate: truncate,

        // 함수
        debounce: debounce,
        throttle: throttle,

        // 숫자
        formatNumber: formatNumber,
        formatPercent: formatPercent,
        clamp: clamp,
        safeParseInt: safeParseInt,
        safeParseFloat: safeParseFloat,

        // 날짜
        getCurrentDate: getCurrentDate,
        getCurrentDateTime: getCurrentDateTime
    };

    console.log('✅ Utils 유틸리티 모듈 로드 완료');

})();
