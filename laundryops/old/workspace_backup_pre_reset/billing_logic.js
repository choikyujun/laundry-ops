// 요금제별 기능 제한 로직 (기능명, 필요 요금제 레벨)
const PLAN_LIMITS = {
    'LIGHT': 1,
    'BUSINESS': 2,
    'ENTERPRISE': 3
};

const PLAN_FEATURES = {
    'UNLIMITED_ISSUANCE': 2,    // 비즈니스 이상
    'STAFF_MANAGEMENT': 2,     // 비즈니스 이상
    'ADVANCED_STATS': 3,       // 엔터프라이즈 전용
    'SPECIAL_HOTEL': 3,        // 엔터프라이즈 전용 (2단 명세서)
    'DATA_BACKUP': 3           // 엔터프라이즈 전용
};

// 현재 공장의 요금제 레벨을 반환
function getFactoryPlanLevel(factory) {
    if (!factory.plan) return 1; // 기본 라이트
    switch(factory.plan) {
        case '무료요금제': return 3; // 무료요금제도 엔터프라이즈(3)와 동일
        case '엔터프라이즈': return 3;
        case '비즈니스': return 2;
        case '라이트': return 1;
        default: return 1;
    }
}

// 기능 접근 제어 (checkAccess 호출부 - SQL-First 버전)
window.checkAccess = async function(featureKey, factory, customMessage) {
    let f = factory;
    if (!f) {
        const { data } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).maybeSingle();
        f = data;
    }
    if (!f) return false;
    
    const currentLevel = getFactoryPlanLevel(f);
    const requiredLevel = PLAN_FEATURES[featureKey] || 1;
    
    if (currentLevel >= requiredLevel) {
        return true;
    } else {
        const msg = customMessage || '현재 요금제에서는 지원하지 않는 기능입니다. \n [요금제 업그레이드]를 확인해주세요.';
        alert(msg);
        return false;
    }
}

// 건수 제한 체크 함수
window.checkIssuanceLimit = function(factory) {
    if (getFactoryPlanLevel(factory) >= 2) return true; // 비즈니스 이상은 무제한
    
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    const issuedThisMonth = (factory.history || []).filter(inv => inv.date.startsWith(currentMonth)).length;
    
    // 테스트용 제한 제거: 월 300건
    if (issuedThisMonth >= 300) {
        alert('라이트 요금제는 월 300건까지만 발행 가능합니다.');
        return false;
    }
    return true;
}

// 거래처 등록 제한 체크 함수
window.checkHotelLimit = function(factory) {
    if (getFactoryPlanLevel(factory) >= 2) return true; // 비즈니스 이상은 무제한
    
    const hotelCount = Object.keys(factory.hotels || {}).length;
    
    // 라이트 요금제 제한: 20개
    if (hotelCount >= 20) {
        alert('라이트 요금제는 거래처를 20개까지만 등록할 수 있습니다. \n [요금제 업그레이드] 해주세요');
        return false;
    }
    return true;
}
