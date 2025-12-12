# ============================================================================

# 📝 DOCUMENTATION FORMAT STANDARDS - 문서화 포맷 표준

# ============================================================================

# 작성일: 2025-11-27

# 목적: 모든 언어/파일 유형에 대한 문서화 표준 포맷 정의

# 적용범위: JavaScript, TypeScript, Java, Python, CSS, HTML, SQL 등

# ============================================================================

# ============================================================================

# 📌 섹션 1: JSDoc 표준 (JavaScript)

# ============================================================================

## 1.1 파일 헤더 포맷 (필수)

```javascript
/**
 * @fileoverview [모듈명] - [역할/목적 한 줄 설명]
 *
 * [상세 설명]
 * 코딩을 모르는 사람도 이해할 수 있도록 모듈의 역할과 동작을 상세히 설명합니다.
 * 이 모듈이 왜 필요한지, 어떤 문제를 해결하는지 명시합니다.
 *
 * @file [파일명].js
 * @module [모듈명]
 * @version 1.0.0
 * @since YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 * @author [작성자명]
 *
 * @requires [의존모듈1] - [의존 이유 설명]
 * @requires [의존모듈2] - [의존 이유 설명]
 *
 * @architecture
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      [상위 모듈명]                           │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *         ┌───────────────────┼───────────────────┐
 *         ▼                   ▼                   ▼
 *    [Core 모듈]         [Data 모듈]         [UI 모듈]
 *
 * @structure
 * - init(): 모듈 초기화
 * - process(): 핵심 로직 처리
 * - render(): UI 렌더링
 * - destroy(): 모듈 정리
 *
 * @features
 * - [주요 기능 1]
 * - [주요 기능 2]
 * - [주요 기능 3]
 *
 * @example
 * // 기본 사용법
 * import { ModuleName } from './module.js';
 * ModuleName.init();
 *
 * @see [관련모듈1] - [관계 설명]
 * @see [관련모듈2] - [관계 설명]
 *
 * @group [Core|Data|UI|Index|Utils]
 */
```

## 1.2 함수/메서드 문서화 포맷

```javascript
/**
 * [함수 목적 한 줄 설명]
 *
 * [상세 설명]
 * 함수가 수행하는 작업을 단계별로 설명합니다.
 * 특별한 주의사항이나 제약조건이 있다면 명시합니다.
 *
 * @function [함수명]
 * @memberof [소속모듈]
 * @since YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 *
 * @param {string} paramName - 파라미터 설명
 * @param {number} [optionalParam=10] - 선택적 파라미터 (기본값: 10)
 * @param {Object} options - 옵션 객체
 * @param {string} options.key1 - 옵션 속성 1
 * @param {boolean} options.key2 - 옵션 속성 2
 *
 * @returns {Promise<Object>} 반환값 설명
 * @returns {string} return.id - 반환 객체의 id 속성
 * @returns {string} return.name - 반환 객체의 name 속성
 *
 * @throws {Error} 에러 발생 조건 설명
 * @throws {TypeError} 타입 에러 발생 조건
 *
 * @example
 * // 기본 사용
 * const result = await functionName('value', { key1: 'a', key2: true });
 *
 * @example
 * // 에러 처리 포함
 * try {
 *   const result = await functionName('value');
 * } catch (error) {
 *   console.error(error);
 * }
 *
 * @see [관련함수]
 * @todo [TODO 항목이 있다면]
 */
function functionName(paramName, options = {}) {
  // 구현
}
```

## 1.3 클래스 문서화 포맷

```javascript
/**
 * [클래스명] - [역할 한 줄 설명]
 *
 * [상세 설명]
 * 이 클래스의 목적, 사용 시나리오, 주요 기능을 설명합니다.
 *
 * @class ClassName
 * @classdesc 클래스에 대한 상세 설명
 * @since YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 * @author [작성자명]
 *
 * @property {string} propertyName - 속성 설명
 * @property {number} count - 카운트 속성
 *
 * @example
 * const instance = new ClassName({ option1: 'value' });
 * instance.doSomething();
 */
class ClassName {
  /**
   * 클래스 생성자
   *
   * @constructor
   * @param {Object} options - 생성자 옵션
   * @param {string} options.option1 - 옵션 1 설명
   */
  constructor(options = {}) {
    // 구현
  }
}
```

## 1.4 상수/설정 문서화 포맷

```javascript
/**
 * [상수 그룹명] 상수 정의
 *
 * @constant {Object} CONSTANTS
 * @property {number} MAX_RETRY - 최대 재시도 횟수
 * @property {number} TIMEOUT_MS - 타임아웃 (밀리초)
 * @property {string} API_VERSION - API 버전
 */
const CONSTANTS = {
  /** 최대 재시도 횟수 */
  MAX_RETRY: 3,

  /** 타임아웃 (밀리초) */
  TIMEOUT_MS: 5000,

  /** API 버전 */
  API_VERSION: "v1",
};
```

## 1.5 이벤트 핸들러 문서화 포맷

```javascript
/**
 * [이벤트명] 이벤트 핸들러
 *
 * [상세 설명]
 * 이 이벤트가 발생하는 조건과 처리 내용을 설명합니다.
 *
 * @listens [이벤트명]
 * @param {Event} event - 이벤트 객체
 * @param {HTMLElement} event.target - 이벤트 대상 요소
 *
 * @fires [발생시키는 커스텀 이벤트]
 */
function handleClick(event) {
  // 구현
}
```

## 1.6 섹션 구분 주석 (코드 그룹화)

```javascript
/* ============================================================================
 * 섹션명 (예: 초기화 함수, 이벤트 핸들러, 유틸리티 등)
 * ============================================================================ */

// ----------------------------------------------------------------------------
// 서브섹션명
// ----------------------------------------------------------------------------

// 단일 라인 설명
```

# ============================================================================

# 📌 섹션 2: TSDoc 표준 (TypeScript)

# ============================================================================

## 2.1 파일 헤더 포맷

```typescript
/**
 * @fileoverview [모듈명] - [역할/목적 한 줄 설명]
 *
 * @packageDocumentation
 * @module [모듈명]
 * @version 1.0.0
 * @since YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 */
```

## 2.2 인터페이스 문서화 포맷

```typescript
/**
 * [인터페이스명] - [역할 설명]
 *
 * @interface IInterfaceName
 * @since YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 *
 * @example
 * const obj: IInterfaceName = {
 *   id: '123',
 *   name: 'example'
 * };
 */
interface IInterfaceName {
  /** 고유 식별자 */
  id: string;

  /** 이름 */
  name: string;

  /** 선택적 설명 */
  description?: string;
}
```

## 2.3 타입 문서화 포맷

```typescript
/**
 * [타입명] - [용도 설명]
 *
 * @typedef {Object} TypeName
 * @property {string} prop1 - 속성 1 설명
 * @property {number} prop2 - 속성 2 설명
 */
type TypeName = {
  prop1: string;
  prop2: number;
};

/**
 * 상태 타입
 * - 'idle': 대기 상태
 * - 'loading': 로딩 중
 * - 'success': 성공
 * - 'error': 에러 발생
 */
type Status = "idle" | "loading" | "success" | "error";
```

## 2.4 제네릭 함수 문서화

```typescript
/**
 * 배열에서 조건에 맞는 첫 번째 요소를 찾습니다.
 *
 * @typeParam T - 배열 요소 타입
 * @param items - 검색할 배열
 * @param predicate - 조건 함수
 * @returns 찾은 요소 또는 undefined
 *
 * @example
 * const users = [{ id: 1, name: 'John' }];
 * const user = findFirst(users, u => u.id === 1);
 */
function findFirst<T>(
  items: T[],
  predicate: (item: T) => boolean
): T | undefined {
  return items.find(predicate);
}
```

# ============================================================================

# 📌 섹션 3: JavaDoc 표준 (Java)

# ============================================================================

## 3.1 클래스 파일 헤더 포맷

```java
/**
 * [클래스명] - [역할 한 줄 설명]
 *
 * <p>[상세 설명]
 * 이 클래스의 목적, 사용 시나리오, 주요 기능을 설명합니다.</p>
 *
 * <h2>주요 기능</h2>
 * <ul>
 *   <li>기능 1 설명</li>
 *   <li>기능 2 설명</li>
 * </ul>
 *
 * <h2>사용 예시</h2>
 * <pre>{@code
 * ClassName instance = new ClassName();
 * instance.doSomething();
 * }</pre>
 *
 * @author [작성자명]
 * @version 1.0.0
 * @since YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 * @see RelatedClass
 */
public class ClassName {
    // 구현
}
```

## 3.2 메서드 문서화 포맷

```java
/**
 * [메서드 목적 한 줄 설명]
 *
 * <p>[상세 설명]
 * 메서드가 수행하는 작업을 단계별로 설명합니다.</p>
 *
 * @param paramName 파라미터 설명
 * @param options 옵션 객체
 * @return 반환값 설명
 * @throws IllegalArgumentException 파라미터가 null인 경우
 * @throws IOException 파일 처리 중 에러 발생 시
 *
 * @version 1.0.0
 * @since YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 * @see #relatedMethod()
 *
 * @deprecated 2.0.0부터 {@link #newMethod()} 사용을 권장합니다.
 */
public ReturnType methodName(String paramName, Options options)
    throws IllegalArgumentException, IOException {
    // 구현
}
```

## 3.3 필드 문서화 포맷

```java
/**
 * [필드 설명]
 *
 * <p>이 필드의 용도, 유효한 값 범위, 기본값 등을 설명합니다.</p>
 *
 * @version 1.0.0
 * @since YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 */
private String fieldName;

/** 최대 재시도 횟수 (기본값: 3) */
private static final int MAX_RETRY = 3;
```

## 3.4 Enum 문서화 포맷

```java
/**
 * [Enum명] - [용도 설명]
 *
 * <p>각 상수의 의미와 사용 시나리오를 설명합니다.</p>
 *
 * @author [작성자명]
 * @since YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 */
public enum Status {
    /** 대기 상태 - 아직 처리되지 않음 */
    PENDING,

    /** 처리 중 - 현재 작업 진행 중 */
    PROCESSING,

    /** 완료 - 정상적으로 처리됨 */
    COMPLETED,

    /** 실패 - 에러 발생으로 처리 실패 */
    FAILED
}
```

# ============================================================================

# 📌 섹션 4: Python Docstring 표준 (Google Style)

# ============================================================================

## 4.1 모듈 헤더 포맷

```python
"""[모듈명] - [역할 한 줄 설명]

[상세 설명]
이 모듈의 목적, 주요 기능, 사용 시나리오를 설명합니다.
코딩을 모르는 사람도 이해할 수 있도록 상세히 작성합니다.

Example:
    기본 사용법::

        from module import ClassName
        instance = ClassName()
        result = instance.do_something()

Attributes:
    MODULE_CONSTANT (str): 모듈 레벨 상수 설명

Todo:
    * TODO 항목 1
    * TODO 항목 2

Note:
    주의사항이나 특별한 고려사항을 여기에 작성합니다.

.. moduleauthor:: [작성자명] <email@example.com>
.. versionadded:: YYYY-MM-DD
"""
```

## 4.2 함수 Docstring 포맷

```python
def function_name(param1: str, param2: int = 10) -> dict:
    """[함수 목적 한 줄 설명]

    [상세 설명]
    함수가 수행하는 작업을 단계별로 설명합니다.

    Args:
        param1 (str): 첫 번째 파라미터 설명
        param2 (int, optional): 두 번째 파라미터 설명. Defaults to 10.

    Returns:
        dict: 반환값 설명
            - key1 (str): key1 설명
            - key2 (int): key2 설명

    Raises:
        ValueError: param1이 빈 문자열인 경우
        TypeError: param2가 정수가 아닌 경우

    Example:
        >>> result = function_name('value', 20)
        >>> print(result)
        {'key1': 'value', 'key2': 20}

    Note:
        특별한 주의사항이 있다면 여기에 작성합니다.

    See Also:
        related_function: 관련 함수 설명
    """
    pass
```

## 4.3 클래스 Docstring 포맷

```python
class ClassName:
    """[클래스명] - [역할 한 줄 설명]

    [상세 설명]
    이 클래스의 목적, 사용 시나리오, 주요 메서드를 설명합니다.

    Attributes:
        attribute1 (str): 속성 1 설명
        attribute2 (int): 속성 2 설명

    Example:
        >>> instance = ClassName(param='value')
        >>> instance.do_something()

    Note:
        스레드 안전성, 성능 고려사항 등을 여기에 작성합니다.
    """

    def __init__(self, param: str):
        """클래스 생성자

        Args:
            param (str): 초기화 파라미터 설명
        """
        self.attribute1 = param
```

# ============================================================================

# 📌 섹션 5: CSS/SCSS 주석 표준

# ============================================================================

## 5.1 파일 헤더 포맷

```css
/**
 * ==========================================================================
 * [스타일시트명] - [역할/목적]
 * ==========================================================================
 *
 * @file        [파일명].css
 * @description [상세 설명]
 * @author      [작성자명]
 * @version     1.0.0
 * @since       YYYY-MM-DD
 * @modified YYYY-MM-DD [수정 내용]
 *
 * @structure
 * 1. 변수 정의 (CSS Custom Properties)
 * 2. 기본 스타일 (Base Styles)
 * 3. 레이아웃 (Layout)
 * 4. 컴포넌트 (Components)
 * 5. 유틸리티 (Utilities)
 * 6. 반응형 (Responsive)
 *
 * ==========================================================================
 */
```

## 5.2 섹션 구분 주석

```css
/* ==========================================================================
   섹션명 (대분류)
   ========================================================================== */

/* --------------------------------------------------------------------------
   서브섹션명 (중분류)
   -------------------------------------------------------------------------- */

/* 소분류 또는 컴포넌트명 */

/* 단일 라인 설명 */
```

## 5.3 컴포넌트 문서화

```css
/**
 * [컴포넌트명]
 * 
 * @description [컴포넌트 설명]
 * @example
 * <div class="component-name">
 *   <div class="component-name__element">...</div>
 * </div>
 * 
 * @modifiers
 * - .component-name--modifier1: [설명]
 * - .component-name--modifier2: [설명]
 */
.component-name {
  /* 기본 스타일 */
}
```

## 5.4 SCSS 변수/믹스인 문서화

```scss
/// [변수 설명]
/// @type {Color}
/// @example
///   background-color: $primary-color;
$primary-color: #3498db;

/// [믹스인 설명]
/// @param {String} $direction - 방향 (row | column)
/// @param {String} $justify - 정렬 (flex-start | center | flex-end)
/// @output Flexbox 레이아웃 스타일
/// @example
///   .container {
///     @include flex-layout(row, center);
///   }
@mixin flex-layout($direction: row, $justify: flex-start) {
  display: flex;
  flex-direction: $direction;
  justify-content: $justify;
}
```

# ============================================================================

# 📌 섹션 6: HTML 주석 표준

# ============================================================================

## 6.1 파일 헤더 포맷

```html
<!--
============================================================================
[페이지/컴포넌트명] - [역할/목적]
============================================================================

@file        [파일명].html
@description [상세 설명]
@author      [작성자명]
@version     1.0.0
@since       YYYY-MM-DD
@modified     YYYY-MM-DD [수정 내용]

@structure
1. 헤더 영역 (Header)
2. 메인 콘텐츠 (Main Content)
3. 사이드바 (Sidebar)
4. 푸터 영역 (Footer)

============================================================================
-->
```

## 6.2 섹션 구분 주석

```html
<!-- ========================================
     섹션명 (시작)
     ======================================== -->

<!-- 콘텐츠 -->

<!-- // 섹션명 (끝) -->

<!-- 단일 라인 설명 -->
```

## 6.3 컴포넌트 문서화

```html
<!-- 
[컴포넌트명]
@description [컴포넌트 설명]
@props
  - data-id: [용도 설명]
  - data-type: [용도 설명]
-->
<div class="component-name" data-id="" data-type="">
  <!-- 컴포넌트 내용 -->
</div>
```

## 6.4 조건부 주석 (IE 대응 - 참고용)

```html
<!--[if IE]>
  <p>IE 전용 콘텐츠</p>
<![endif]-->

<!--[if !IE]><!-->
<p>IE 외 브라우저 콘텐츠</p>
<!--<![endif]-->
```

# ============================================================================

# 📌 섹션 7: SQL 주석 표준

# ============================================================================

## 7.1 스크립트 파일 헤더

```sql
-- ============================================================================
-- [스크립트명] - [목적]
-- ============================================================================
--
-- @file        [파일명].sql
-- @description [상세 설명]
-- @author      [작성자명]
-- @version     1.0.0
-- @since       YYYY-MM-DD
--
-- @database    [데이터베이스명]
-- @schema      [스키마명]
--
-- @modified    YYYY-MM-DD [수정 내용]
--
-- ============================================================================
```

## 7.2 프로시저/함수 문서화

```sql
-- ============================================================================
-- [프로시저/함수명]
-- ============================================================================
--
-- @description [상세 설명]
--
-- @param   IN  p_param1    VARCHAR(100)    파라미터 1 설명
-- @param   IN  p_param2    INT             파라미터 2 설명
-- @param   OUT p_result    VARCHAR(100)    결과 파라미터 설명
--
-- @return  INT  0: 성공, -1: 실패
--
-- @example
-- CALL procedure_name('value1', 100, @result);
-- SELECT @result;
--
-- @author  [작성자명]
-- @since   YYYY-MM-DD
-- ============================================================================
CREATE PROCEDURE procedure_name(
    IN p_param1 VARCHAR(100),
    IN p_param2 INT,
    OUT p_result VARCHAR(100)
)
BEGIN
    -- 구현
END;
```

## 7.3 쿼리 블록 주석

```sql
-- ----------------------------------------------------------------------------
-- [쿼리 블록 설명]
-- ----------------------------------------------------------------------------
-- 목적: [이 쿼리가 하는 일]
-- 조건: [WHERE 절 조건 설명]
-- 정렬: [ORDER BY 설명]
-- ----------------------------------------------------------------------------
SELECT
    column1,        -- 컬럼1 설명
    column2,        -- 컬럼2 설명
    column3         -- 컬럼3 설명
FROM
    table_name t
WHERE
    t.status = 'ACTIVE'     -- 활성 상태만 조회
    AND t.created_at >= :startDate  -- 시작일 이후
ORDER BY
    t.created_at DESC;      -- 최신순 정렬
```

## 7.4 테이블/컬럼 주석

```sql
-- 테이블 생성 시 주석
CREATE TABLE table_name (
    id          INT PRIMARY KEY     COMMENT '고유 식별자',
    name        VARCHAR(100)        COMMENT '이름',
    status      VARCHAR(20)         COMMENT '상태 (ACTIVE/INACTIVE)',
    created_at  DATETIME            COMMENT '생성일시'
) COMMENT='[테이블 설명]';

-- 테이블 주석 추가/수정
COMMENT ON TABLE table_name IS '[테이블 설명]';
COMMENT ON COLUMN table_name.column_name IS '[컬럼 설명]';
```

# ============================================================================

# 📌 섹션 8: JSP 주석 표준

# ============================================================================

## 8.1 파일 헤더 포맷

```jsp
<%--
============================================================================
[페이지명] - [역할/목적]
============================================================================

@file        [파일명].jsp
@description [상세 설명]
@author      [작성자명]
@version     1.0.0
@since       YYYY-MM-DD

@request
  - param1 (String): 파라미터 1 설명
  - param2 (Integer): 파라미터 2 설명

@model
  - modelAttr1: 모델 속성 1 설명
  - modelAttr2: 모델 속성 2 설명

@include
  - /common/header.jsp: 헤더 영역
  - /common/footer.jsp: 푸터 영역

============================================================================
--%>
```

## 8.2 섹션 구분 주석

```jsp
<%-- ========================================
     섹션명 (시작)
     ======================================== --%>

<%-- 콘텐츠 --%>

<%-- // 섹션명 (끝) --%>
```

## 8.3 스크립틀릿 문서화

```jsp
<%--
[스크립틀릿 목적 설명]
- 처리 1: 설명
- 처리 2: 설명
--%>
<%
    // 구현
%>
```

# ============================================================================

# 📌 섹션 9: 인라인 주석 규칙 (공통)

# ============================================================================

## 9.1 인라인 주석 작성 원칙

- 코드 "왜(Why)"를 설명 (What은 코드 자체로)
- 복잡한 로직, 비즈니스 규칙, 우회 방법 설명
- 자명한 코드에 불필요한 주석 금지

## 9.2 인라인 주석 예시

```javascript
// 좋은 예: "왜"를 설명
const delay = 300; // 애니메이션 완료 대기 (CSS transition: 0.3s)

// 좋은 예: 비즈니스 규칙 설명
if (age >= 19) {
  // 법적 성인 기준 (민법 제4조)
  // ...
}

// 나쁜 예: 자명한 코드에 불필요한 주석
const count = 0; // count를 0으로 초기화
```

## 9.3 TODO/FIXME/HACK 주석

```javascript
// TODO: [담당자] 설명 (기한: YYYY-MM-DD)
// FIXME: [담당자] 버그 설명 (기한: YYYY-MM-DD)
// HACK: [담당자] 임시 해결책 설명 - 추후 리팩토링 필요
// OPTIMIZE: [담당자] 성능 개선 필요 - 현재 O(n²)
// REVIEW: [담당자] 코드 리뷰 필요
```

# ============================================================================

# 📌 섹션 10: 문서화 체크리스트

# ============================================================================

## 10.1 파일 레벨 체크리스트

- [ ] 파일 헤더 주석 작성 완료
- [ ] @fileoverview 또는 모듈 설명 포함
- [ ] @author, @version, @since 명시
- [ ] @requires 의존성 목록 작성
- [ ] @structure 또는 구조 설명 포함

## 10.2 함수/메서드 레벨 체크리스트

- [ ] 목적 한 줄 설명 작성
- [ ] 모든 파라미터 @param 문서화
- [ ] @returns 반환값 문서화
- [ ] @throws 예외 상황 문서화
- [ ] @example 사용 예시 포함

## 10.3 클래스/컴포넌트 레벨 체크리스트

- [ ] 클래스 목적 및 역할 설명
- [ ] public 속성 @property 문서화
- [ ] 생성자 파라미터 문서화
- [ ] 사용 예시 포함

## 10.4 품질 체크리스트

- [ ] 코딩을 모르는 사람도 이해 가능한 수준
- [ ] 오타, 문법 오류 없음
- [ ] 코드 변경 시 주석 동기화됨
- [ ] 불필요한 주석 제거됨

# ============================================================================

# ⚠️ 문서화 포맷 규칙 적용 안내

# ============================================================================

#

# 이 문서는 모든 프로젝트에서 사용하는 문서화 표준 포맷입니다.

# 언어/프레임워크에 맞는 포맷을 선택하여 일관되게 적용하세요.

#

# 핵심 원칙:

# 1. 코딩을 모르는 사람도 이해할 수 있는 수준으로 작성

# 2. "무엇을(What)"보다 "왜(Why)"를 설명

# 3. 코드 변경 시 주석도 함께 업데이트

# 4. 프로젝트 내 일관된 포맷 유지

#

# ============================================================================
