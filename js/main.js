/* =========================================
   하늘매트 - main.js
   ========================================= */

/**
 * ★ Google Apps Script 배포 URL ★
 * 상담 신청 시 구글 시트로 데이터를 전송합니다.
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwuUP8_TqkJz0CrOfUJP2zV9_otBZem-SnF4rmbk--TELf9Jnl93P-sNrFvMniouiQN/exec';

/**
 * 주소 검색 (Daum Postcode API)
 */
function searchAddress() {
  new daum.Postcode({
    oncomplete: function (data) {
      let addr = '';
      if (data.userSelectedType === 'R') addr = data.roadAddress;
      else addr = data.jibunAddress;

      document.getElementById('addr1').value = addr;
      document.getElementById('addr2').focus();
    }
  }).open();
}

/* =========================================
   ★ Supabase 시공후기 앨범 설정 ★
   ========================================= */
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';

// 샘플 데이터 (Supabase 연결 전 또는 데이터가 없을 때 표시)
// 실제 데이터 (Naver Blog & Cafe 크롤링 데이터)
const MOCK_DATA = [
  { id: 1, title: '[Blog] 인천 국공립 힐스꿈 어린이집', category: 'best', image_url: 'https://mblogthumb-phinf.pstatic.net/MjAyNjAzMTdfMTQg/MDAxNzczNzA2OTM3MjUy.84k-c2_6oheGHiSZECbK9MbUfgp1WykGCQUSj0-01nEg.63Un9xQFHT64wUXlTFgBXFroL4gXsc2bP7jF_gum9LMg.JPEG/20260317092142.jpg?type=w800', description: '국공립 어린이집 600 베이지 시공사례 (2026.03.17)', link: 'https://m.blog.naver.com/one19a/224219256682' },
  { id: 2, title: '[Blog] 왕길역 로열파크씨티 푸르지오', category: '2026', image_url: 'https://mblogthumb-phinf.pstatic.net/MjAyNjAzMTZfMjUx/MDAxNzczNjE5NjMwODI0.mRCsoDhzCRdhn7wpzg4JZiWyx0DWBEizEDkly56RFigg.WeG6RpsLbC-jgr68tQeGak-v-qOWjAfIbvhWB4Yw9jcg.JPEG/20260316090619.jpg?type=ffn300_300', description: '아파트 거실 600 화이트 시공사례 (2026.03.16)', link: 'https://m.blog.naver.com/one19a/224217886041' },
  { id: 3, title: '[Blog] 서울 래미안라그란데 아파트', category: '2026', image_url: 'https://mblogthumb-phinf.pstatic.net/MjAyNjA0MTRfOTkg/MDAxNzc2MTI1ODQzOTQw.iAFahWzOIJEjYplvLCVNaftAxds8Dm4OyVJ8D6TQt4gg.LUNLazh6Mv8w7ubhMuRtOWvXkTF1HGg6X-6UWGK4zbQg.JPEG/20260414091652.jpg?type=ffn300_300', description: '대단지 아파트 600 화이트 시공사례 (2026.03.12)', link: 'https://m.blog.naver.com/one19a/224213487501' },
  { id: 4, title: '[Cafe] 김포 하늘매트 후기', category: 'best', image_url: 'https://cafeptthumb-phinf.pstatic.net/MjAyNjA0MTNfMjU2/MDAxNzc2MDc4NDIzMjA2.oJLCRpqcy8HeZ3t80uSUTcxTXHvVOrwnIbpuiH6rr7og.T7JzNL3VfgVcHS5BWq9WN65hiCkBiKrQvlzP1lIJlZwg.JPEG/IMG%EF%BC%BF9751.JPG?type=f145_145', description: '로봇청소기 구동 완벽 확인, 김포 시공 솔직 후기 (2026.04.13)', link: 'https://m.cafe.naver.com/ArticleRead.nhn?clubid=29694871&articleid=3528' },
  { id: 5, title: '[Cafe] 100일 아기 집 필수템', category: 'all', image_url: 'https://phinf.pstatic.net/image.nmv/cafe_2026_04_10_3793/szvS6pU8OG_01.jpg?type=f100x100', description: '아이 머리쿵 방지 및 층간소음 해결 후기 (2026.04.10)', link: 'https://m.cafe.naver.com/ArticleRead.nhn?clubid=29694871&articleid=3526' },
  { id: 6, title: '[Cafe] 영유아 2명 집 필수템', category: 'all', image_url: 'https://phinf.pstatic.net/image.nmv/cafe_2026_04_07_3434/HmCogXbPuh_01.jpg?type=f100x100', description: '활동량 많은 아이들을 위한 안심 시공 후기 (2026.04.07)', link: 'https://m.cafe.naver.com/ArticleRead.nhn?clubid=29694871&articleid=3524' }
];

let albumData = [];

// Supabase 클라이언트 초기화 (설정값이 기본값이면 null 반환)
const isConfigured = SUPABASE_URL !== 'https://your-project.supabase.co';
const _supabase = (typeof supabase !== 'undefined' && isConfigured) ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/**
 * 실시간 시공 앨범 로드 (Supabase 우선, 실패 시 Mock Data)
 */
async function loadAlbumBoard(category = 'all') {
  const grid = document.getElementById('albumGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="album-loader"><i class="fa-solid fa-spinner fa-spin"></i> 사진을 불러오는 중...</div>';

  // 1. Supabase 연동 시도
  if (_supabase) {
    try {
      let query = _supabase
        .from('installation_photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        albumData = data;
        renderAlbum(albumData);
        return;
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to mock data:', err);
    }
  }

  // 2. Mock Data 필터링 및 출력 (Supabase 미설정 또는 데이터 없음)
  console.log('Using Mock Data for gallery');
  albumData = (category === 'all') 
    ? MOCK_DATA 
    : MOCK_DATA.filter(item => item.category === category);
  
  setTimeout(() => renderAlbum(albumData), 500); // 부드러운 로딩 연출
}

function renderAlbum(data) {
  const grid = document.getElementById('albumGrid');
  if (!grid) return;

  if (data.length === 0) {
    grid.innerHTML = '<div class="album-loader">등록된 시공 사진이 없습니다.</div>';
    return;
  }

  grid.innerHTML = data.map((item, index) => `
    <div class="album-item" onclick="openAlbumLightbox(${index})">
      <div class="album-img">
        <img src="${item.image_url}" alt="${item.title}" loading="lazy">
      </div>
      <div class="album-meta">
        <span class="product-tag" style="margin-bottom:8px; display:inline-block; font-size:0.75rem; background: #E2E8F0; color: #475569;">#${item.category.toUpperCase()}</span>
        <h4>${item.title}</h4>
        <p>${item.description || ''}</p>
      </div>
    </div>
  `).join('');
}

function openAlbumLightbox(index) {
  const lb    = document.getElementById('gdriveLightbox');
  const img   = document.getElementById('lightboxImg');
  const title = document.getElementById('lightboxTitle');
  const cap   = document.getElementById('lightboxCaption');
  const item  = albumData[index];

  if (!item) return;

  img.src = item.image_url;
  if (title) title.textContent = item.title;
  if (cap) cap.textContent = item.description || '';
  
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAlbumLightbox() {
  const lb = document.getElementById('gdriveLightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

/* 앨범 인터랙션 이벤트 */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('albumBoard')) {
    loadAlbumBoard('all');

    // 필터 버튼
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadAlbumBoard(btn.dataset.category);
      });
    });

    // 라이트박스 닫기
    document.getElementById('lightboxClose')?.addEventListener('click', closeAlbumLightbox);
    document.getElementById('gdriveLightbox')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeAlbumLightbox();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAlbumLightbox();
    });
  }
});

/* ===== 번역 데이터 ===== */
const i18n = {
  ko: {
    'nav.why': '하늘매트 이유',
    'nav.material': 'TPU 소재',
    'nav.space': '적용 공간',
    'nav.product': '제품 라인업',
    'nav.cert': '인증 현황',
    'nav.gallery': '시공사례',
    'nav.cta': '무료 상담',

    'hero.badge1': '3년연속 소비자선정 브랜드 대상',
    'hero.badge2': 'KC 인증',
    'hero.badge3': 'KACI 친환경 인증',
    'hero.eyebrow': '안전과 편안함의 설계',
    'hero.title': '모든 공간이<br /><em>안전한 하늘공간이</em><br />될 수 있도록',
    'hero.sub': '하늘매트의 검증된 실력과 시공전문성 하스놀 주식회사의 안심철학 제조기술이 만나서 완성합니다.',
    'hero.cta1': '카카오톡 상담',
    'hero.cta2': '제품 보러가기',
    'tag.home': '가정집', 'tag.daycare': '어린이집', 'tag.care': '요양시설',
    'tag.hospital': '병원', 'tag.pet': '애견센터', 'tag.hotel': '호텔', 'tag.church': '교회',
    'stat.sgs': 'SGS 충격흡수율',
    'stat.cert': '공인 인증 보유',
    'stat.yearUnit': '년',
    'stat.brand': '연속 브랜드 대상',
    'stat.radon': '라돈 불검출',

    'trust.1': '화학성분 無 — 깨끗하게',
    'trust.2': '친환경 무가교 방식 제조',
    'trust.3': '층간소음·충격 프리미엄 완화',
    'trust.4': '피부느낌 그대로 최고급 TPU',
    'trust.5': '600~1200mm 맞춤 시공',

    'why.tag': '하늘매트 이유',
    'why.h2': '왜 <em>하늘매트</em>일까요?',
    'why.sub': '소음은 비우고 안심은 채워, 모두가 행복한 공간을 디자인합니다',
    'why.c1.title': '영유아 머리쿵 방지',
    'why.c1.desc': '기어다니기·걸음마 연습으로 인해 넘어지고 부딪히는 우리 아이, 큰 사고로 이어지는 것을 <strong>방지</strong>할 수 있어요!',
    'why.c2.title': '아동 층간소음 저감',
    'why.c2.desc': '뛰어놀기, 점프와 같은 신체적인 활동으로 인해 발생하는 이웃과의 갈등을 <strong>예방</strong>할 수 있어요!',
    'why.c3.title': '어르신 낙상 방지',
    'why.c3.desc': '노화, 관절약화, 균형감각 저하로 발생하는 낙상 사고를 미리 <strong>방지</strong>할 수 있어요! <em class="tag-note">대퇴부골절예방</em>',
    'why.c4.title': '반려동물 관절 보호',
    'why.c4.desc': '미끄러짐, 잦은 골 탈구, 관절 손상, 발톱 소음으로 고생하는 우리 댕댕이 항상 치료를 <strong>예방</strong>할 수 있어요!',

    'mat.h2': '안심을 더한<br /><em>프리미엄 친환경 소재</em>',
    'mat.sub': '일상에서 쉽게 접하는 제품들이 TPU를 사용하는 이유는 명확합니다',

    'space.h2': '모든 공간에는<br /><em>그에 맞는 바닥</em>이 필요합니다',
    'space.sub': '돌봄의 현장부터 일상의 보금자리까지, 공간의 목적을 완성하는 커스텀 바닥 솔루션',
    'space.tab1': '돌봄 및 교육',
    'space.tab2': '의료 및 복지',
    'space.tab3': '생활 및 상업',

    'prod.h2': '하늘매트 <em>제품 라인업</em>',
    'prod.sub': '하늘매트는 카니의 기준이 아닌, 각자의 생활에 어울리는 바닥을 생각합니다',
    'prod.filter.all': '전체',
    'prod.filter.tpu': '일반 TPU',
    'prod.filter.premium': '프리미엄 TPU',
    'prod.filter.leather': '레자PE',
    'prod.filter.roll': '롤매트',

    'cert.h2': '공인 시험을 통해<br /><em>확인된 안정성</em>',
    'cert.sub': '우리 가족이 가장 오래 머무는 곳이기에 수가지 항목의 검사를 완료하였습니다',

    'gallery.h2': '생활 속의 <em>하늘매트</em>',
    'gallery.sub': '생활 속 오래남을 바닥을 위해, 마지막까지 선종하게 시공합니다',
    'gallery.tab1': '가정집',
    'gallery.tab2': '어린이집',
    'gallery.tab3': '복지·의료',

    'review.h2': '이유 있는 선택,<br /><em>증명된 평안함</em>',
    'review.sub': '수많은 앞집과 가족들이 하늘매트를 고집하는 이유, 글과로 증명합니다',

    'process.tag': '시공 안내',
    'process.h2': '간단한 <em>4단계</em> 시공 과정',
    'process.sub': '전문 시공팀이 처음부터 끝까지 책임집니다.',
    'process.s1.title': '상담 문의', 'process.s1.desc': '카카오톡 또는 전화로 공간·평수 정보를 알려주세요.',
    'process.s2.title': '맞춤 견적', 'process.s2.desc': '공간 특성과 사용자 패턴을 분석해 최적 솔루션 제안.',
    'process.s3.title': '전문 시공', 'process.s3.desc': '숙련된 전문 시공팀이 방문, 마지막까지 선종하게 시공.',
    'process.s4.title': 'A/S 보증',  'process.s4.desc': '시공 후 품질 보증 및 신속한 A/S를 제공합니다.',

    'faq.h2': '궁금한 점을 <em>해결</em>해 드립니다',

    'contact.tag': '무료 상담',
    'contact.h2': '지금 바로 <em>무료 상담</em>을 받아보세요',
    'contact.sub': '공간의 특성과 사용자의 활동 패턴을 분석하여<br />가장 최적화된 시공 솔루션을 제안드립니다.',
    'contact.f1': '무료 현장 방문 견적',
    'contact.f2': '600~1200mm 맞춤 제작',
    'contact.f3': '10개 공인 인증 제품',
    'contact.f4': '가정·기관·복지시설 전문',
  },

  zh: {
    'nav.why': '选择理由', 'nav.material': 'TPU材质', 'nav.space': '应用空间',
    'nav.product': '产品系列', 'nav.cert': '认证信息', 'nav.gallery': '施工案例', 'nav.cta': '免费咨询',
    'hero.badge1': '连续3年消费者品牌奖', 'hero.badge2': 'KC认证', 'hero.badge3': 'KACI环保认证',
    'hero.eyebrow': '安全与舒适的设计',
    'hero.title': '让每一个空间<br />成为<em>安全的天空空间</em>',
    'hero.sub': 'HASNOL的安心理念与HAUL MAT的技术相结合，<br />打造<strong>最完善的地板解决方案</strong>。',
    'hero.cta1': 'KakaoTalk咨询', 'hero.cta2': '查看产品',
    'tag.home': '住宅', 'tag.daycare': '幼儿园', 'tag.care': '养老设施',
    'tag.hospital': '医院', 'tag.pet': '宠物中心', 'tag.hotel': '酒店', 'tag.church': '教会',
    'stat.sgs': 'SGS冲击吸收率', 'stat.cert': '官方认证', 'stat.yearUnit': '年',
    'stat.brand': '连续品牌大奖', 'stat.radon': '零氡检出',
    'trust.1': '无化学成分 — 纯净安全', 'trust.2': '环保无交联工艺制造',
    'trust.3': '层间噪音·冲击高效隔绝', 'trust.4': '肤感极佳顶级TPU材质', 'trust.5': '600~1200mm定制施工',
    'why.tag': '选择理由', 'why.h2': '为什么选择<em>HAUL MAT</em>？',
    'why.sub': '减少噪音，增添安心，为所有人设计幸福空间',
    'why.c1.title': '婴幼儿头部保护',
    'why.c1.desc': '保护学爬、学步的宝宝免受碰撞，<strong>防止</strong>发生严重事故！',
    'why.c2.title': '儿童层间噪音降低',
    'why.c2.desc': '跑跳等身体活动产生的噪音，有效<strong>预防</strong>邻里纠纷！',
    'why.c3.title': '老人防跌倒',
    'why.c3.desc': '因老化、关节退化、平衡感下降导致的跌倒风险，提前<strong>预防</strong>！<em class="tag-note">股骨骨折预防</em>',
    'why.c4.title': '宠物关节保护',
    'why.c4.desc': '滑倒、关节脱臼、爪声噪音，<strong>预防</strong>爱宠的高额医疗费用！',
    'mat.h2': '更安心的<br /><em>高端环保材质</em>', 'mat.sub': '日常生活中随处可见TPU产品，安全性已得到充分验证',
    'space.h2': '每个空间<br />都需要<em>适合的地板</em>', 'space.sub': '从托育现场到日常家居，打造符合空间目的的定制地板方案',
    'space.tab1': '托育及教育', 'space.tab2': '医疗及福利', 'space.tab3': '生活及商业',
    'prod.h2': 'HAUL MAT <em>产品系列</em>', 'prod.sub': '不以统一标准衡量，为每种生活方式量身设计地板',
    'prod.filter.all': '全部', 'prod.filter.tpu': '普通TPU', 'prod.filter.premium': '高端TPU',
    'prod.filter.leather': '皮革PE', 'prod.filter.roll': '卷材',
    'cert.h2': '通过官方检测<br /><em>验证的安全性</em>', 'cert.sub': '家人停留时间最长的地方，我们完成了多项严格检测认证',
    'gallery.h2': '生活中的<em>HAUL MAT</em>', 'gallery.sub': '每一处施工都精益求精，为您打造经久耐用的地板',
    'gallery.tab1': '住宅', 'gallery.tab2': '幼儿园', 'gallery.tab3': '福利·医疗',
    'review.h2': '有理由的选择，<br /><em>经过验证的安心</em>', 'review.sub': '无数家庭坚持选择HAUL MAT，用真实体验来证明',
    'process.tag': '施工说明', 'process.h2': '简单<em>4步</em>施工流程', 'process.sub': '专业施工团队全程负责到底',
    'process.s1.title': '咨询', 'process.s1.desc': '通过KakaoTalk或电话告知空间及面积信息',
    'process.s2.title': '定制报价', 'process.s2.desc': '分析空间特性与使用习惯，提供最优方案',
    'process.s3.title': '专业施工', 'process.s3.desc': '熟练施工团队上门，精心完成每一处细节',
    'process.s4.title': 'A/S保修', 'process.s4.desc': '施工完成后提供质量保证及快速售后服务',
    'faq.h2': '为您<em>解答</em>常见问题',
    'contact.tag': '免费咨询', 'contact.h2': '立即获取<em>免费咨询</em>',
    'contact.sub': '分析您空间的特性与使用需求，<br />为您推荐最优化的施工方案',
    'contact.f1': '免费上门报价', 'contact.f2': '600~1200mm定制制作',
    'contact.f3': '10项官方认证产品', 'contact.f4': '住宅·机构·福利设施专业',
  },

  ja: {
    'nav.why': '選ぶ理由', 'nav.material': 'TPU素材', 'nav.space': '適用空間',
    'nav.product': '製品ラインナップ', 'nav.cert': '認証情報', 'nav.gallery': '施工事例', 'nav.cta': '無料相談',
    'hero.badge1': '3年連続消費者ブランド大賞', 'hero.badge2': 'KC認証', 'hero.badge3': 'KACI環境認証',
    'hero.eyebrow': '安全と安らぎのデザイン',
    'hero.title': 'すべての空間を<br /><em>安全な天空空間に</em>',
    'hero.sub': 'HASNOLの安心哲学とHAUL MATの技術力が出会い、<br /><strong>最高の床ソリューション</strong>を完成させます。',
    'hero.cta1': 'KakaoTalk相談', 'hero.cta2': '製品を見る',
    'tag.home': '住宅', 'tag.daycare': '保育園', 'tag.care': '介護施設',
    'tag.hospital': '病院', 'tag.pet': 'ペットセンター', 'tag.hotel': 'ホテル', 'tag.church': '教会',
    'stat.sgs': 'SGS衝撃吸収率', 'stat.cert': '公認認証数', 'stat.yearUnit': '年',
    'stat.brand': '連続ブランド大賞', 'stat.radon': 'ラドン不検出',
    'trust.1': '化学成分なし — 清潔・安全', 'trust.2': '環境に優しい無架橋製法',
    'trust.3': '階間騒音・衝撃をプレミアム緩和', 'trust.4': '肌触り抜群の高級TPU', 'trust.5': '600~1200mmオーダーメイド施工',
    'why.tag': '選ぶ理由', 'why.h2': 'なぜ<em>HAUL MAT</em>なの？',
    'why.sub': '騒音を減らし、安心を増やし、みんなが幸せな空間をデザインします',
    'why.c1.title': '乳幼児の頭部保護',
    'why.c1.desc': 'ハイハイや歩行練習中に転んで大怪我になるのを<strong>防止</strong>できます！',
    'why.c2.title': '子どもの階間騒音低減',
    'why.c2.desc': '走り回ったりジャンプしたりする活動による近隣トラブルを<strong>予防</strong>できます！',
    'why.c3.title': '高齢者の転倒防止',
    'why.c3.desc': '老化・関節弱化・バランス感覚低下による転倒事故を事前に<strong>防止</strong>できます！<em class="tag-note">大腿骨骨折予防</em>',
    'why.c4.title': 'ペットの関節保護',
    'why.c4.desc': '滑り・関節脱臼・爪音で苦労するペットの高額治療を<strong>予防</strong>できます！',
    'mat.h2': '安心プラスの<br /><em>プレミアム環境素材</em>', 'mat.sub': '身近な製品がTPUを使う理由は明確です — 最も安全な選択肢だからです',
    'space.h2': 'すべての空間に<br /><em>最適な床</em>が必要です', 'space.sub': '保育現場から日常の住まいまで、空間の目的を完成するカスタム床ソリューション',
    'space.tab1': '保育・教育', 'space.tab2': '医療・福祉', 'space.tab3': '生活・商業',
    'prod.h2': 'HAUL MAT <em>製品ラインナップ</em>', 'prod.sub': '一つの基準ではなく、それぞれのライフスタイルに合わせた床を考えます',
    'prod.filter.all': '全て', 'prod.filter.tpu': '一般TPU', 'prod.filter.premium': 'プレミアムTPU',
    'prod.filter.leather': 'レザーPE', 'prod.filter.roll': 'ロールマット',
    'cert.h2': '公認試験で確認された<br /><em>安全性</em>', 'cert.sub': 'ご家族が最も長く過ごす場所だからこそ、多くの項目の検査を完了しました',
    'gallery.h2': '暮らしの中の<em>HAUL MAT</em>', 'gallery.sub': '最後まで丁寧に施工します',
    'gallery.tab1': '住宅', 'gallery.tab2': '保育園', 'gallery.tab3': '福祉・医療',
    'review.h2': '理由ある選択、<br /><em>証明された安らぎ</em>', 'review.sub': '多くのご家族がHAUL MATを選ぶ理由、実体験で証明します',
    'process.tag': '施工案内', 'process.h2': 'シンプルな<em>4ステップ</em>施工', 'process.sub': '専門施工チームが最初から最後まで責任を持ちます',
    'process.s1.title': 'ご相談', 'process.s1.desc': 'KakaoTalkまたはお電話でスペース情報をお知らせください',
    'process.s2.title': 'カスタム見積', 'process.s2.desc': '空間特性と使用パターンを分析して最適解を提案',
    'process.s3.title': 'プロ施工', 'process.s3.desc': '熟練した専門チームが訪問し、丁寧に施工します',
    'process.s4.title': 'A/S保証', 'process.s4.desc': '施工後の品質保証と迅速なアフターサービスを提供します',
    'faq.h2': 'よくある質問を<em>解決</em>します',
    'contact.tag': '無料相談', 'contact.h2': '今すぐ<em>無料相談</em>を受けてください',
    'contact.sub': '空間の特性と使用者のニーズを分析して、<br />最適化された施工ソリューションをご提案します',
    'contact.f1': '無料現場見積', 'contact.f2': '600~1200mmオーダーメイド',
    'contact.f3': '10種の公認認証製品', 'contact.f4': '住宅・施設・福祉施設専門',
  },

  vi: {
    'nav.why': 'Lý do chọn', 'nav.material': 'Chất liệu TPU', 'nav.space': 'Ứng dụng',
    'nav.product': 'Sản phẩm', 'nav.cert': 'Chứng nhận', 'nav.gallery': 'Dự án', 'nav.cta': 'Tư vấn miễn phí',
    'hero.badge1': 'Giải thương hiệu 3 năm liên tiếp', 'hero.badge2': 'Chứng nhận KC', 'hero.badge3': 'Chứng nhận KACI',
    'hero.eyebrow': 'Thiết kế an toàn & thoải mái',
    'hero.title': 'Mọi không gian<br />đều có thể là<em> Không gian Bầu Trời An Toàn</em>',
    'hero.sub': 'Triết lý an tâm của HASNOL kết hợp công nghệ HAUL MAT,<br />tạo ra <strong>giải pháp sàn hoàn hảo nhất</strong>.',
    'hero.cta1': 'Tư vấn KakaoTalk', 'hero.cta2': 'Xem sản phẩm',
    'tag.home': 'Nhà ở', 'tag.daycare': 'Nhà trẻ', 'tag.care': 'Cơ sở dưỡng lão',
    'tag.hospital': 'Bệnh viện', 'tag.pet': 'Trung tâm thú cưng', 'tag.hotel': 'Khách sạn', 'tag.church': 'Nhà thờ',
    'stat.sgs': 'Hấp thụ xung động SGS', 'stat.cert': 'Chứng nhận chính thức', 'stat.yearUnit': 'năm',
    'stat.brand': 'Giải thương hiệu liên tiếp', 'stat.radon': 'Không có radon',
    'trust.1': 'Không hóa chất — Sạch & An toàn', 'trust.2': 'Sản xuất không liên kết ngang thân thiện môi trường',
    'trust.3': 'Giảm tiếng ồn & chấn động hiệu quả', 'trust.4': 'TPU cao cấp mềm mại như da', 'trust.5': '600~1200mm thi công tùy chỉnh',
    'why.tag': 'Lý do chọn HAUL MAT', 'why.h2': 'Tại sao chọn<em> HAUL MAT</em>?',
    'why.sub': 'Loại bỏ tiếng ồn, thêm vào bình yên — thiết kế không gian hạnh phúc cho tất cả mọi người',
    'why.c1.title': 'Bảo vệ đầu trẻ sơ sinh',
    'why.c1.desc': 'Bảo vệ bé tập bò, tập đi khỏi va đập, <strong>ngăn ngừa</strong> tai nạn nghiêm trọng!',
    'why.c2.title': 'Giảm tiếng ồn giữa các tầng',
    'why.c2.desc': 'Tiếng chạy nhảy của trẻ gây mâu thuẫn với hàng xóm — <strong>phòng ngừa</strong> hiệu quả!',
    'why.c3.title': 'Phòng ngừa ngã cho người cao tuổi',
    'why.c3.desc': 'Lão hóa, yếu khớp, mất cân bằng gây ngã — <strong>phòng ngừa</strong> trước khi xảy ra!<em class="tag-note">Phòng gãy xương đùi</em>',
    'why.c4.title': 'Bảo vệ khớp thú cưng',
    'why.c4.desc': 'Trơn trượt, trật khớp, tiếng móng vuốt — <strong>phòng ngừa</strong> chi phí thú y tốn kém!',
    'mat.h2': 'Chất liệu thân thiện<br /><em>cao cấp an toàn</em>', 'mat.sub': 'Lý do TPU được dùng trong các sản phẩm hàng ngày rất rõ ràng — đơn giản là lựa chọn an toàn nhất',
    'space.h2': 'Mỗi không gian cần<br /><em>sàn phù hợp</em>', 'space.sub': 'Từ cơ sở chăm sóc đến nhà ở hàng ngày — giải pháp sàn tùy chỉnh hoàn thành mục đích của mỗi không gian',
    'space.tab1': 'Chăm sóc & Giáo dục', 'space.tab2': 'Y tế & Phúc lợi', 'space.tab3': 'Sinh hoạt & Thương mại',
    'prod.h2': 'HAUL MAT <em>Dòng sản phẩm</em>', 'prod.sub': 'Không một tiêu chuẩn duy nhất — sàn được thiết kế cho từng lối sống',
    'prod.filter.all': 'Tất cả', 'prod.filter.tpu': 'TPU thường', 'prod.filter.premium': 'TPU cao cấp',
    'prod.filter.leather': 'Da PE', 'prod.filter.roll': 'Thảm cuộn',
    'cert.h2': 'An toàn được xác minh<br /><em>qua kiểm định chính thức</em>', 'cert.sub': 'Nơi gia đình bạn ở lâu nhất — được kiểm định qua mọi chứng nhận quan trọng',
    'gallery.h2': 'HAUL MAT <em>trong cuộc sống</em>', 'gallery.sub': 'Thi công tỉ mỉ từ đầu đến cuối — sàn bền đẹp theo thời gian',
    'gallery.tab1': 'Nhà ở', 'gallery.tab2': 'Nhà trẻ', 'gallery.tab3': 'Phúc lợi & Y tế',
    'review.h2': 'Lựa chọn có lý do,<br /><em>sự thoải mái được chứng minh</em>', 'review.sub': 'Hàng trăm gia đình chọn HAUL MAT — họ tự nói lên điều đó',
    'process.tag': 'Hướng dẫn thi công', 'process.h2': 'Quy trình <em>4 bước</em> đơn giản', 'process.sub': 'Đội thi công chuyên nghiệp phụ trách từ đầu đến cuối',
    'process.s1.title': 'Tư vấn', 'process.s1.desc': 'Liên hệ qua KakaoTalk hoặc điện thoại với thông tin không gian của bạn',
    'process.s2.title': 'Báo giá tùy chỉnh', 'process.s2.desc': 'Phân tích không gian & thói quen sử dụng để đề xuất giải pháp tối ưu',
    'process.s3.title': 'Thi công chuyên nghiệp', 'process.s3.desc': 'Đội thi công lành nghề đến tận nơi, lắp đặt tỉ mỉ cẩn thận',
    'process.s4.title': 'Bảo hành A/S', 'process.s4.desc': 'Bảo đảm chất lượng và dịch vụ hậu mãi nhanh chóng sau thi công',
    'faq.h2': 'Chúng tôi <em>giải đáp</em> mọi thắc mắc',
    'contact.tag': 'Tư vấn miễn phí', 'contact.h2': 'Nhận <em>tư vấn miễn phí</em> ngay bây giờ',
    'contact.sub': 'Chúng tôi phân tích nhu cầu không gian của bạn<br />và đề xuất giải pháp sàn tối ưu nhất',
    'contact.f1': 'Báo giá tận nơi miễn phí', 'contact.f2': 'Tùy chỉnh 600~1200mm',
    'contact.f3': 'Sản phẩm 10+ chứng nhận', 'contact.f4': 'Chuyên gia nhà ở, tổ chức & phúc lợi',
  },

  en: {
    'nav.why': 'Why Haul Mat',
    'nav.material': 'TPU Material',
    'nav.space': 'Applications',
    'nav.product': 'Products',
    'nav.cert': 'Certifications',
    'nav.gallery': 'Portfolio',
    'nav.cta': 'Free Consult',

    'hero.badge1': '3-Year Consumer Brand Award',
    'hero.badge2': 'KC Certified',
    'hero.badge3': 'KACI Eco Certified',
    'hero.eyebrow': 'Designed for Safety & Comfort',
    'hero.title': 'Every Space Can Be<br />a <em>Safe Sky Space</em>',
    'hero.sub': "Where HASNOL's safety philosophy meets HAUL MAT's technology,<br />creating the <strong>perfect flooring solution</strong> for a happier community.",
    'hero.cta1': 'KakaoTalk Consult',
    'hero.cta2': 'View Products',
    'tag.home': 'Home', 'tag.daycare': 'Daycare', 'tag.care': 'Care Facility',
    'tag.hospital': 'Hospital', 'tag.pet': 'Pet Center', 'tag.hotel': 'Hotel', 'tag.church': 'Church',
    'stat.sgs': 'SGS Shock Absorption',
    'stat.cert': 'Official Certifications',
    'stat.yearUnit': 'yr',
    'stat.brand': 'Consecutive Brand Award',
    'stat.radon': 'Zero Radon Detected',

    'trust.1': 'Zero Chemicals — Clean & Safe',
    'trust.2': 'Eco-Friendly No-Crosslink Process',
    'trust.3': 'Premium Noise & Impact Reduction',
    'trust.4': 'Skin-Friendly Premium TPU',
    'trust.5': '600~1200mm Custom Installation',

    'why.tag': 'Why Haul Mat',
    'why.h2': 'Why <em>HAUL MAT</em>?',
    'why.sub': 'Emptying noise, filling peace — designing spaces where everyone is happy.',
    'why.c1.title': 'Infant Head Protection',
    'why.c1.desc': 'Protects babies learning to crawl and walk from bumps and falls — <strong>preventing</strong> serious injury!',
    'why.c2.title': 'Child Noise Reduction',
    'why.c2.desc': 'Jumping and running are part of childhood — <strong>prevent</strong> neighbor disputes with premium sound absorption!',
    'why.c3.title': 'Senior Fall Prevention',
    'why.c3.desc': 'Age-related joint weakness and balance loss — <strong>prevent</strong> dangerous falls before they happen! <em class="tag-note">Hip fracture prevention</em>',
    'why.c4.title': 'Pet Joint Protection',
    'why.c4.desc': 'Slipping, joint dislocation, claw noise — <strong>prevent</strong> costly vet visits for your beloved pet!',

    'mat.h2': 'Premium Eco-Friendly Material<br /><em>You Can Trust</em>',
    'mat.sub': 'The reason everyday products use TPU is clear — it\'s simply the safest choice.',

    'space.h2': 'Every Space Needs<br /><em>the Right Floor</em>',
    'space.sub': 'From childcare facilities to everyday homes — custom flooring that fulfills the purpose of every space.',
    'space.tab1': 'Care & Education',
    'space.tab2': 'Medical & Welfare',
    'space.tab3': 'Living & Commercial',

    'prod.h2': 'HAUL MAT <em>Product Lineup</em>',
    'prod.sub': 'Not one standard — a floor designed for each lifestyle.',
    'prod.filter.all': 'All',
    'prod.filter.tpu': 'Standard TPU',
    'prod.filter.premium': 'Premium TPU',
    'prod.filter.leather': 'Leather PE',
    'prod.filter.roll': 'Roll Mat',

    'cert.h2': 'Safety Verified<br /><em>by Official Testing</em>',
    'cert.sub': 'The place your family spends the most time — verified through every certification that matters.',

    'gallery.h2': '<em>HAUL MAT</em> in Real Life',
    'gallery.sub': 'Installed with care, from start to finish — for floors that last a lifetime.',
    'gallery.tab1': 'Home',
    'gallery.tab2': 'Daycare',
    'gallery.tab3': 'Welfare & Medical',

    'review.h2': 'A Reasoned Choice,<br /><em>Proven Comfort</em>',
    'review.sub': 'Hundreds of families choose HAUL MAT — and they speak for themselves.',

    'process.tag': 'How It Works',
    'process.h2': 'Simple <em>4-Step</em> Process',
    'process.sub': 'Our expert team handles everything from start to finish.',
    'process.s1.title': 'Consultation', 'process.s1.desc': 'Contact us via KakaoTalk or phone with your space details.',
    'process.s2.title': 'Custom Quote',  'process.s2.desc': 'We analyze your space and usage patterns for the optimal solution.',
    'process.s3.title': 'Installation',  'process.s3.desc': 'Our skilled team visits and installs with meticulous care.',
    'process.s4.title': 'A/S Warranty',  'process.s4.desc': 'Quality guarantee and fast after-service provided post-installation.',

    'faq.h2': 'We <em>Answer</em> Your Questions',

    'contact.tag': 'Free Consultation',
    'contact.h2': 'Get Your <em>Free Consultation</em> Now',
    'contact.sub': 'We analyze your space and user needs<br />to propose the most optimized flooring solution.',
    'contact.f1': 'Free on-site estimate',
    'contact.f2': '600~1200mm custom sizing',
    'contact.f3': '10+ official certifications',
    'contact.f4': 'Home, institutional & welfare specialists',
  }
};

let currentLang = 'ko';

function applyLang(lang) {
  currentLang = lang;
  const t = i18n[lang];

  // 일반 텍스트 (data-i18n)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // HTML 포함 텍스트 (data-i18n-html)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  // html lang 속성
  document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';

  // 버튼 active 상태
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

document.addEventListener('DOMContentLoaded', () => {

  /* ===== 카드 클릭 활성화 (why / material) ===== */
  ['why-card', 'material-card'].forEach(cls => {
    const cards = document.querySelectorAll('.' + cls);
    cards.forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });
  });

  /* ===== 0. 언어 선택 드롭다운 ===== */
  const langSwitch  = document.getElementById('langSwitch');
  const langCurrent = document.getElementById('langCurrent');
  const langDropdown = document.getElementById('langDropdown');

  // 드롭다운 열기/닫기
  langCurrent?.addEventListener('click', e => {
    e.stopPropagation();
    langSwitch.classList.toggle('open');
  });

  // 바깥 클릭 시 닫기
  document.addEventListener('click', () => langSwitch?.classList.remove('open'));
  langDropdown?.addEventListener('click', e => e.stopPropagation());

  // 언어 선택
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      const flag = btn.dataset.flag;
      const code = btn.dataset.code;

      // 현재 버튼 표시 업데이트
      langCurrent.querySelector('.lang-flag').textContent = flag;
      langCurrent.querySelector('.lang-code').textContent = code;

      // active 상태 업데이트
      document.querySelectorAll('.lang-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 드롭다운 닫기
      langSwitch.classList.remove('open');

      applyLang(lang);
    });
  });

  /* ===== 1. 헤더 스크롤 효과 ===== */
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });


  /* ===== 2. 모바일 햄버거 메뉴 ===== */
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    nav.classList.toggle('mobile-open');
    document.body.style.overflow = nav.classList.contains('mobile-open') ? 'hidden' : '';
  });

  // 네비 링크 클릭 시 메뉴 닫기
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      nav.classList.remove('mobile-open');
      document.body.style.overflow = '';
    });
  });


  /* ===== 3. 부드러운 스크롤 (앵커) ===== */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });


  /* ===== 4. 제품 필터 ===== */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const productCards = document.querySelectorAll('.product-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      productCards.forEach(card => {
        const categories = card.dataset.category || '';
        if (filter === 'all' || categories.includes(filter)) {
          card.classList.remove('hidden');
          card.style.animation = 'fadeIn .4s ease';
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });


  /* ===== 5. 적용 공간 탭 ===== */
  document.querySelectorAll('.space-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.space-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.space-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('tab-' + tab.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  /* ===== 5-1. 갤러리 탭 ===== */
  document.querySelectorAll('.gtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.gtab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.gallery-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('gtab-' + tab.dataset.gtab);
      if (panel) panel.classList.add('active');
    });
  });

  /* ===== 6. 리뷰 슬라이더 (Swiper) ===== */
  new Swiper('.review-slider', {
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    pagination: {
      el: '.slider-dots',
      clickable: true,
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    breakpoints: {
      768: { slidesPerView: 2 },
      1024: { slidesPerView: 3 }
    },
    autoplay: {
      delay: 4000,
      disableOnInteraction: false,
    }
  });

  /* ===== 6-1. 브로슈어 슬라이더 (Swiper - 모바일 1페이지) ===== */
  new Swiper('.brochureSwiper', {
    slidesPerView: 1,
    spaceBetween: 30,
    loop: true,
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    /* 
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    }
    */
  });


  /* ===== 7. FAQ 아코디언 ===== */
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });


  /* ===== 8. 견적 계산기 ===== */
  // 평형 기준 600mm '거실+복도+주방' 소요량 (장)
  const baseQty = { 24: 88, 34: 115, 40: 135 };
  // 사이즈 전환율 (600mm 대비 장수 배율)
  const sizeRatio = { '1.00': 1.00, '0.73': 0.73, '0.56': 0.56, '0.36': 0.36, '0.25': 0.25 };
  // 배송비 안내 로직
  const shippingFee = qty => qty >= 70 ? '무료' : qty >= 40 ? '10만원' : '20만원';

  let calcState = { pyeong: 24, space: 1.0, size: 1.00 };

  function calcUpdate() {
    const { pyeong, space, size } = calcState;
    const qtyEl = document.getElementById('resultQty');
    if (!pyeong) {
      if (qtyEl) qtyEl.textContent = '—';
      return;
    }
    const base = baseQty[pyeong] || Math.round(pyeong * 3.5);
    const qty  = Math.round(base * space * size);
    if (qtyEl) qtyEl.textContent = `약 ${qty}장`;

    // 견적 요약 → 폼 숨김 필드 & 요약 박스에 자동 반영
    const spaceLabel = document.querySelector('#calcSpace .calc-btn.active')?.textContent?.trim() || '';
    const sizeLabel  = document.querySelector('#calcSize .calc-btn.active')?.textContent?.trim() || '';
    const summaryText = `[견적계산기] ${pyeong}평 / ${spaceLabel} / ${sizeLabel} → 예상 약 ${qty}장`;
    const hiddenEl   = document.getElementById('calcResult');
    if (hiddenEl) hiddenEl.value = summaryText;
    const summaryTextEl = document.getElementById('calcSummaryText');
    if (summaryTextEl) summaryTextEl.textContent = summaryText;
  }

  // 초기화 실행
  calcUpdate();

  // 평형 버튼
  document.getElementById('calcPyeong')?.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('calcPyeong').querySelectorAll('.calc-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const input = document.getElementById('customPyeong');
      if (btn.dataset.val === 'custom') {
        input.classList.remove('hidden');
        calcState.pyeong = null;
      } else {
        input.classList.add('hidden');
        calcState.pyeong = Number(btn.dataset.val);
        calcUpdate();
      }
    });
  });
  document.getElementById('customPyeong')?.addEventListener('input', e => {
    calcState.pyeong = Number(e.target.value) || null;
    calcUpdate();
  });

  // 공간 버튼
  document.getElementById('calcSpace')?.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('calcSpace').querySelectorAll('.calc-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      calcState.space = Number(btn.dataset.val);
      calcUpdate();
    });
  });

  // 사이즈 버튼
  document.getElementById('calcSize')?.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('calcSize').querySelectorAll('.calc-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      calcState.size = Number(btn.dataset.val);
      calcUpdate();
    });
  });

  /* ===== 9. 상담 폼 제출 ===== */
  // 전화번호 입력 자동 이동
  ['phone1','phone2'].forEach((id, idx) => {
    const nextId = ['phone2','phone3'][idx];
    document.getElementById(id)?.addEventListener('input', e => {
      const max = [3,4][idx];
      if (e.target.value.replace(/\D/g,'').length >= max) {
        document.getElementById(nextId)?.focus();
      }
    });
  });

  // 파일명 표시
  document.getElementById('floorFile')?.addEventListener('change', e => {
    const label = document.getElementById('fileNameLabel');
    if (label) label.textContent = e.target.files[0]?.name || '';
  });

  const form = document.getElementById('contactForm');
  form?.addEventListener('submit', async e => {
    e.preventDefault();

    const name       = document.getElementById('cName')?.value.trim();
    const p1         = document.getElementById('phone1')?.value.trim();
    const p2         = document.getElementById('phone2')?.value.trim();
    const p3         = document.getElementById('phone3')?.value.trim();
    const addr1      = document.getElementById('addr1')?.value.trim();
    const addr2      = document.getElementById('addr2')?.value.trim();
    const installDate = document.getElementById('installDate')?.value;
    const areaType   = document.getElementById('areaType')?.value.trim();
    const memo       = document.getElementById('memo')?.value.trim();
    const sample     = document.getElementById('sample')?.value;
    const sampleNote = document.getElementById('sampleNote')?.value.trim();

    // 필수 항목 검증
    if (!name)        { alert('이름을 입력해 주세요.');           return; }
    if (!p1||!p2||!p3){ alert('연락처를 모두 입력해 주세요.');    return; }
    if (!addr1)       { alert('주소를 입력해 주세요.');           return; }
    if (!installDate) { alert('시공희망날짜를 선택해 주세요.');   return; }
    if (!areaType)    { alert('평형타입/시공범위를 입력해 주세요.'); return; }
    if (!sample)      { alert('샘플 희망여부를 선택해 주세요.');  return; }

    const phone = `${p1}-${p2}-${p3}`;


    // 버튼 로딩 상태
    const submitBtn = form.querySelector('.btn-submit');
    const origText  = submitBtn.textContent;
    submitBtn.textContent = '전송 중...';
    submitBtn.disabled = true;

    try {
      // 1. 구글 시트 전송 (Apps Script)
      const googleSheetData = {
        name,
        phone,
        address: `${addr1} ${addr2}`.trim(),
        installDate,
        areaType,
        sample: sample === 'yes' ? '✅ 희망' : '❌ 불필요',
        sampleNote,
        memo,
        calcResult: document.getElementById('calcResult')?.value || '',
        timestamp: new Date().toLocaleString('ko-KR')
      };

      if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== 'YOUR_APPS_SCRIPT_URL') {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(googleSheetData)) {
          params.append(key, value);
        }
        fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        })
        .then(() => console.log('Google Sheet 전송 시도됨'))
        .catch(err => console.error('Google Sheet 전송 지연:', err));
      }

      // 2. 폼 성공 처리
      showFormSuccess(googleSheetData, form);

    } catch (err) {
      console.error('상담 신청 오류:', err);
      alert('접수 중 오류가 발생했습니다. 카카오톡으로 문의해 주세요.');
    } finally {
      submitBtn.textContent = origText;
      submitBtn.disabled = false;
    }
  });

  function showFormSuccess(data, form) {
    // 카카오톡에 전달할 메시지 포맷팅
    const kakaoText = `[하늘매트 상담신청]\n` +
      `■ 이름: ${data.name}\n` +
      `■ 연락처: ${data.phone}\n` +
      `■ 주소: ${data.address}\n` +
      `■ 희망일: ${data.installDate}\n` +
      `■ 범위: ${data.areaType}\n` +
      `■ 샘플: ${data.sample}\n` +
      (data.sampleNote ? `■ 매트사이즈: ${data.sampleNote}\n` : '') +
      (data.memo ? `■ 문의사항: ${data.memo}\n` : '') +
      (data.calcResult ? `\n${data.calcResult}` : '');

    // 폼을 완료 메시지로 교체
    const card = form.closest('.contact-card');
    if (card) {
      card.innerHTML = `
        <div class="form-success">
          <div class="form-success-icon"><i class="fa-solid fa-circle-check"></i></div>
          <h3>${data.name}님, 상담 신청 완료!</h3>
          <p>구글 시트에 정보가 안전하게 저장되었습니다.</p>
          <div class="form-success-kakao-box">
            <p><strong>상담 내용을 카카오톡으로도 전달하시겠습니까?</strong><br>내용이 복사되어 상담이 더 빨라집니다.</p>
            <button class="btn-kakao-send" id="btnShareKakao">
              <i class="fa-brands fa-kakao"></i> 카카오톡으로 상담 내용 전달
            </button>
          </div>
          <p class="form-success-contact">
            <i class="fa-solid fa-phone"></i> 빠른 문의: 1877-2008
          </p>
          <button class="btn-reset" onclick="location.reload()">다시 신청하기</button>
        </div>`;

      // 카카오톡 버튼 이벤트
      document.getElementById('btnShareKakao')?.addEventListener('click', () => {
        // 클립보드 복사 시도
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(kakaoText).then(() => {
            alert('상담 내용이 복사되었습니다! 카카오톡 대화창에 붙여넣어주세요.');
            window.open('https://pf.kakao.com/_yBrxhG/chat', '_blank');
          }).catch(err => {
            console.error('복사 실패:', err);
            window.open('https://pf.kakao.com/_yBrxhG/chat', '_blank');
          });
        } else {
          // 구형 브라우저 대응
          const textArea = document.createElement("textarea");
          textArea.value = kakaoText;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            alert('상담 내용이 복사되었습니다! 카카오톡 대화창에 붙여넣어주세요.');
          } catch (err) {
            console.error('복사 실패');
          }
          document.body.removeChild(textArea);
          window.open('https://pf.kakao.com/_yBrxhG/chat', '_blank');
        }
      });
    }
  }


  /* ===== 9. 맨 위로 버튼 ===== */
  const scrollTopBtn = document.getElementById('scrollTop');
  window.addEventListener('scroll', () => {
    scrollTopBtn?.classList.toggle('hidden', window.scrollY < 400);
  }, { passive: true });
  scrollTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));


  /* ===== 10. Scroll Fade-up 애니메이션 ===== */
  const fadeEls = document.querySelectorAll(
    '.why-card, .material-card, .cert-badge, .product-card, .gallery-item, .review-card, .process-step, .faq-item, .space-item, .tpu-example, .discount-card, .welfare-card, .yt-item, .board-item'
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  fadeEls.forEach(el => {
    el.classList.add('fade-up');
    observer.observe(el);
  });


  /* ===== 11. 숫자 카운트 업 애니메이션 ===== */
  const stats = document.querySelectorAll('.stat strong');
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const text = el.textContent;
      const num = parseFloat(text.replace(/[^0-9.]/g, ''));
      if (isNaN(num)) return;
      const suffix = text.replace(/[0-9.,]/g, '').trim();
      const duration = 1500;
      const step = 16;
      const steps = duration / step;
      let count = 0;

      const timer = setInterval(() => {
        count++;
        const val = num < 100 ? +(num * (count / steps)).toFixed(1) : Math.round(num * (count / steps));
        el.textContent = val + suffix;
        if (count >= steps) {
          el.textContent = num + suffix;
          clearInterval(timer);
        }
      }, step);

      countObserver.unobserve(el);
    });
  }, { threshold: 0.5 });

  stats.forEach(el => countObserver.observe(el));

  /* ===== 13. 기업 협력 문의 폼 ===== */
  const bizForm = document.getElementById('bizForm');
  if (bizForm) {
    bizForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const type  = document.getElementById('bizType')?.value || '';
      const name  = document.getElementById('bizName')?.value || '';
      const phone = document.getElementById('bizPhone')?.value || '';
      const email = document.getElementById('bizEmail')?.value || '';
      const memo  = document.getElementById('bizMemo')?.value || '';

      if (!type || !name || !phone || !memo) {
        alert('문의 유형, 회사명/성함, 연락처, 문의 내용은 필수 입력 항목입니다.');
        return;
      }

      const subject = encodeURIComponent(`[하늘매트 기업협력] ${type} 문의 - ${name}`);
      const body = encodeURIComponent(
        `[문의 유형] ${type}\n` +
        `[회사명/성함] ${name}\n` +
        `[연락처] ${phone}\n` +
        `[이메일] ${email || '미입력'}\n\n` +
        `[문의 내용]\n${memo}`
      );

      window.location.href = `mailto:one19119@naver.com?subject=${subject}&body=${body}`;

      bizForm.innerHTML = `
        <div style="text-align:center;padding:40px 0;">
          <i class="fa-solid fa-circle-check" style="font-size:3rem;color:#1565C0;margin-bottom:16px;display:block;"></i>
          <h3 style="color:#1565C0;margin-bottom:8px;">문의가 접수되었습니다</h3>
          <p style="color:#64748B;">이메일 앱이 열렸습니다. 발송 후 영업일 1~2일 내에 연락드리겠습니다.</p>
        </div>`;
    });
  }

  /* ===== 12. 와이퍼 (Before/After) 슬라이더 ===== */
  document.querySelectorAll('.wiper-compare').forEach(wrap => {
    const range   = wrap.querySelector('.wiper-range');
    const after   = wrap.querySelector('.wiper-after');
    const divider = wrap.querySelector('.wiper-divider');

    function applyVal(val) {
      const pct = 100 - val;
      after.style.clipPath = `inset(0 ${pct}% 0 0)`;
      divider.style.left   = `${val}%`;
    }

    applyVal(range.value);
    range.addEventListener('input', () => applyVal(range.value));
  });

});
