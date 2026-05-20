/**
 * 하늘매트 홈페이지 - 상담 신청 및 기업 제안 처리 (구글시트 저장 + 솔라피 문자 + 이메일 2개 발송)
 * Google Apps Script Web App
 */

// ★ 스프레드시트 ID (스프레드시트 내에서 '확장 프로그램 -> Apps Script'를 클릭해 만들었으면 비워두셔도 자동 인식됩니다) ★
const SHEET_ID = '';

// ★ 상담 알림을 받을 이메일 주소 (여러 개일 경우 콤마로 구분하여 작성) ★
const NOTIFY_EMAIL = 'one19119@naver.com,paul@hasnol.kr';

// ★ 발신자 이름 ★
const SENDER_NAME = '하늘매트';

// ★ 솔라피(SOLAPI) 설정 ★
const SOLAPI_API_KEY = 'NCSEI0BPHUGSGJQE';
const SOLAPI_API_SECRET = '636FK1NIGBC9GQKTEQGU67XG2IZP9ADK';

// [중요] 발신 전화번호 (솔라피에 서류 등록 및 승인 완료된 번호)
const SENDER_PHONE = '01075471197';

// ★ 카카오 알림톡 설정 ★
// 1. 솔라피 콘솔 → 카카오 → 채널 관리 → 채널 추가 후 pfId 입력 (KA01로 시작하는 코드)
const KAKAO_PF_ID = 'KA01PF260520090950714wD2j2i1gAhC';

// 2. 알림톡 템플릿 등록·승인 후 코드 입력
const KAKAO_TEMPLATE_CONSULT = '9KIS4On7qa';  // [하늘매트] 새 시공 상담이 접수되었습니다.
const KAKAO_TEMPLATE_BIZ     = '4li51hK0KL';  // [하늘매트] 기업 협력 문의가 접수되었습니다.

// 3. 알림 받을 010 번호 목록 (카카오톡 계정 연동된 번호)
//    ※ 070 번호는 카카오/문자 수신 불가 — 반드시 010 번호로 입력
const ADMIN_PHONES = [
  '01075471197',
];


/**
 * POST 요청 처리 - 폼 데이터 수신
 */
function doPost(e) {
  try {
    // 1) 데이터 추출
    let data = {};
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }

    const formType = data.formType || 'consult'; // 'consult' (고객상담) 또는 'biz' (기업협력)

    // ① 구글시트 저장
    const receiptNo = saveToSheet(data, '', formType);

    // ② 이메일 발송
    if (NOTIFY_EMAIL) {
      sendNotificationEmail(data, receiptNo, formType);
    }

    // ③ 카카오 알림톡 (pfId·템플릿 코드 입력 후 자동 전환) / 미설정 시 SMS
    let smsResult = '솔라피 설정 미완료';
    if (SOLAPI_API_KEY && SOLAPI_API_KEY !== 'YOUR_SOLAPI_API_KEY') {
      smsResult = sendNotifications(data, formType);
      updateSmsResultInSheet(receiptNo, smsResult, formType);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success', receiptNo: receiptNo, smsResult: smsResult }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error(err);
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET 요청 처리 - 연결 테스트용
 */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'shorts') return getShortsData();
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok', message: '하늘매트 Apps Script 정상 작동 중' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * YouTube 쇼츠 최신 12개 반환 (1시간 캐시)
 * - 채널 Shorts 탭 페이지를 스크래핑해 /shorts/ID 패턴으로 추출 (가장 정확)
 * - 실패 시 RSS에서 /shorts/ID HTTP 200 체크로 폴백
 */
function getShortsData() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'shorts_v3';
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.ids && parsed.ids.length > 0) {
      return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }
  }

  const channelId = 'UCJnWOugRSSv3Oqzir2FgNRA';

  // 1차: 채널 Shorts 탭 직접 스크래핑
  try {
    const html = UrlFetchApp.fetch(
      'https://www.youtube.com/channel/' + channelId + '/shorts',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        },
        muteHttpExceptions: true
      }
    ).getContentText();

    const matches = html.match(/\/shorts\/([a-zA-Z0-9_-]{11})/g) || [];
    const ids = [];
    const seen = {};
    for (var i = 0; i < matches.length; i++) {
      var id = matches[i].replace('/shorts/', '');
      if (!seen[id]) { seen[id] = true; ids.push(id); }
      if (ids.length >= 12) break;
    }

    if (ids.length >= 3) {
      var json = JSON.stringify({ status: 'ok', ids: ids });
      cache.put(CACHE_KEY, json, 3600);
      return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    console.error('Shorts 탭 스크래핑 실패:', err);
  }

  // 2차 폴백: RSS 최신순 6개 (이 채널은 쇼츠 전용)
  try {
    const xml = UrlFetchApp.fetch(
      'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId
    ).getContentText();

    const doc = XmlService.parse(xml);
    const atomNs = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    const ytNs   = XmlService.getNamespace('http://www.youtube.com/xml/schemas/2015');
    const entries = doc.getRootElement().getChildren('entry', atomNs);
    const videoIds = entries
      .map(function(entry) { return entry.getChildText('videoId', ytNs); })
      .filter(Boolean)
      .slice(0, 12);

    if (videoIds.length > 0) {
      var json = JSON.stringify({ status: 'ok', ids: videoIds });
      cache.put(CACHE_KEY, json, 3600);
      return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    console.error('RSS 폴백 실패:', err);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', ids: [] }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Google Sheets에 데이터 저장
 */
function saveToSheet(data, smsResult, formType) {
  let ss;
  if (SHEET_ID && SHEET_ID !== 'YOUR_GOOGLE_SHEET_ID') {
    ss = SpreadsheetApp.openById(SHEET_ID);
  } else {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
      throw new Error("구글 시트를 찾을 수 없습니다. SHEET_ID 변수에 스프레드시트 ID를 입력해 주세요.");
    }
  }

  if (!ss) {
    throw new Error("스프레드시트 연결에 실패했습니다.");
  }

  // 폼 유형에 따른 시트 선택
  const sheetName = formType === 'biz' ? '제휴신청' : '상담신청';
  let sheet = ss.getSheetByName(sheetName);

  // 시트가 없으면 새로 생성
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    let headers = [];
    if (formType === 'biz') {
      headers = ['접수번호', '접수시간', '문의유형', '회사명/성함', '연락처', '이메일', '문의내용', '처리상태', '문자발송결과'];
    } else {
      headers = [
        '접수번호', '접수시간', '이름', '연락처',
        '지역/아파트', '시공희망날짜', '평형타입/시공범위',
        '남기는말', '샘플희망여부', '남기고싶은말', '견적계산기결과', '처리상태', '문자발송결과'
      ];
    }
    sheet.appendRow(headers);

    // 헤더 스타일 지정
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(formType === 'biz' ? '#2E7D32' : '#1565C0'); // 기업문의는 초록색, 상담신청은 파란색
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }

  // 접수번호 생성
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateKey = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
  
  let receiptNo = '';
  let rowData = [];

  if (formType === 'biz') {
    receiptNo = `BZ-${dateKey}-${String(sheet.getLastRow()).padStart(3,'0')}`;
    rowData = [
      receiptNo,
      now,
      data.bizType || data.type || '',
      data.name || '',
      data.phone || '',
      data.email || '',
      data.memo || '',
      '📬 접수완료',
      smsResult || ''
    ];
  } else {
    receiptNo = `SM-${dateKey}-${String(sheet.getLastRow()).padStart(3,'0')}`;
    rowData = [
      receiptNo,
      now,
      data.name || '',
      data.phone || '',
      data.address || '',
      data.installDate || '',
      data.areaType || '',
      data.memo || '',
      data.sample || '',
      data.sampleNote || '',
      data.calcResult || '',
      '📬 접수완료',
      smsResult || ''
    ];
  }

  sheet.appendRow(rowData);

  // 셀 서식 정리
  const lastRow = sheet.getLastRow();
  const dataRange = sheet.getRange(lastRow, 1, 1, rowData.length);
  dataRange.setVerticalAlignment('middle');
  dataRange.setWrap(true);

  // 접수번호 열 배경 강조
  sheet.getRange(lastRow, 1).setBackground('#F1F5F9').setFontWeight('bold');

  return receiptNo;
}

/**
 * 시트에 발송 결과 업데이트 (저장 후 알림 결과 기록)
 */
function updateSmsResultInSheet(receiptNo, smsResult, formType) {
  try {
    let ss;
    if (SHEET_ID && SHEET_ID !== 'YOUR_GOOGLE_SHEET_ID') {
      ss = SpreadsheetApp.openById(SHEET_ID);
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    const sheetName = formType === 'biz' ? '제휴신청' : '상담신청';
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === receiptNo) {
        // 마지막 열(문자발송결과)에 업데이트
        sheet.getRange(i + 1, data[i].length).setValue(smsResult);
        break;
      }
    }
  } catch (e) {
    console.error('updateSmsResultInSheet 오류:', e);
  }
}

/**
 * 알림 발송 통합 함수
 * 순서: ① 카카오 알림톡 시도 → 실패(검수중/오류) 시 ② SMS 자동 폴백
 */
function sendNotifications(data, formType) {
  const results = [];
  const useAlimtalk = KAKAO_PF_ID && KAKAO_TEMPLATE_CONSULT;

  for (const phone of ADMIN_PHONES) {
    if (useAlimtalk) {
      const atResult = sendAlimtalk(data, formType, phone);
      if (atResult.includes('실패') || atResult.includes('오류')) {
        // 검수진행중 또는 오류 → SMS로 자동 전환
        const smsResult = sendSms(data, formType, phone);
        results.push('SMS:' + smsResult + ' (알림톡→SMS폴백)');
      } else {
        results.push('알림톡:' + atResult);
      }
    } else {
      results.push(sendSms(data, formType, phone));
    }
  }
  return results.join(' | ');
}

/**
 * 솔라피 카카오 알림톡 발송
 */
function sendAlimtalk(data, formType, toPhone) {
  const url = 'https://api.solapi.com/messages/v4/send';
  const templateId = formType === 'biz' ? KAKAO_TEMPLATE_BIZ : KAKAO_TEMPLATE_CONSULT;

  // 변수명은 솔라피에 등록한 알림톡 템플릿의 #{변수명}과 반드시 일치해야 합니다
  let variables = {};
  if (formType === 'biz') {
    variables = {
      '#{문의유형}':  data.bizType || data.type || '',
      '#{회사명}':    data.name || '',
      '#{연락처}':    data.phone || '',
      '#{이메일}':    data.email || '미입력',
      '#{문의내용}':  data.memo || ''
    };
  } else {
    variables = {
      '#{이름}':      data.name || '',
      '#{연락처}':    data.phone || '',
      '#{주소}':      data.address || '',
      '#{시공일}':    data.installDate || '',
      '#{평형범위}':  data.areaType || '',
      '#{샘플여부}':  data.sample || '',
      '#{문의내용}':  data.memo || '없음'
    };
  }

  const payload = {
    message: {
      to: toPhone,
      from: SENDER_PHONE,
      kakaoOptions: {
        pfId: KAKAO_PF_ID,
        templateId: templateId,
        variables: variables
      }
    }
  };

  return _solapiRequest(url, payload, toPhone);
}

/**
 * 솔라피 SMS 발송 (알림톡 미설정 시 폴백)
 */
function sendSms(data, formType, toPhone) {
  const url = 'https://api.solapi.com/messages/v4/send';

  let text = '';
  if (formType === 'biz') {
    text = `[하늘매트 기업협력 문의]
새로운 비즈니스 제안이 접수되었습니다.

• 유형: ${data.bizType || data.type || ''}
• 회사명/성함: ${data.name || ''}
• 연락처: ${data.phone || ''}
• 이메일: ${data.email || '미입력'}
• 문의내용: ${data.memo || ''}`;
  } else {
    text = `[하늘매트 상담신청]
새로운 시공 상담이 접수되었습니다.

• 이름: ${data.name || ''}
• 연락처: ${data.phone || ''}
• 지역/아파트: ${data.address || ''}
• 시공일: ${data.installDate || ''}
• 평형/범위: ${data.areaType || ''}
• 샘플여부: ${data.sample || ''} ${data.sampleNote ? '(' + data.sampleNote + ')' : ''}
• 문의: ${data.memo || '없음'}

${data.calcResult ? '[견적 계산기 결과]\n' + data.calcResult : ''}`;
  }

  const payload = { message: { to: toPhone, from: SENDER_PHONE, text: text } };
  return _solapiRequest(url, payload, toPhone);
}

/**
 * 솔라피 API 공통 요청 헬퍼
 */
function _solapiRequest(url, payload, toPhone) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: generateSolapiAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET) },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    const res = JSON.parse(UrlFetchApp.fetch(url, options).getContentText());
    if (res.errorCode) return `[${toPhone}] 실패: ${res.errorCode} ${res.errorMessage}`;
    return `[${toPhone}] 성공`;
  } catch (e) {
    return `[${toPhone}] 오류: ${e.toString()}`;
  }
}

/**
 * 솔라피 API 인증용 Signature 생성 헤더 함수
 */
function generateSolapiAuthHeader(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = Utilities.getUuid().replace(/-/g, ''); 
  const data = date + salt;
  
  const signature = Utilities.computeHmacSha256Signature(data, apiSecret)
    .reduce((str, chr) => {
      chr = (chr < 0 ? chr + 256 : chr).toString(16);
      return str + (chr.length === 1 ? '0' : '') + chr;
    }, '');
    
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

/**
 * 이메일 알림 발송 (쉼표로 구분된 모든 수신처로 동시 발송)
 */
function sendNotificationEmail(data, receiptNo, formType) {
  const now = new Date();
  const dateStr = now.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'long'
  });

  let subject = '';
  let htmlBody = '';
  let textBody = '';

  if (formType === 'biz') {
    const type = data.bizType || data.type || '';
    subject = `[하늘매트] 기업 협력 문의 (${type}) - ${data.name}님 (${receiptNo})`;
    
    htmlBody = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Apple SD Gothic Neo',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f7fa">
    <tr><td align="center" style="padding:30px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:30px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">🤝 하늘매트 B2B</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">새로운 기업 협력 / 파트너십 문의가 접수되었습니다</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 30px 16px;">
            <div style="background:#E8F5E9;border-left:4px solid #2E7D32;border-radius:4px;padding:14px 16px;">
              <p style="margin:0;font-size:13px;color:#2E7D32;font-weight:600;">📅 접수시간: ${dateStr} (${receiptNo})</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 30px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td colspan="2" style="padding-bottom:12px;font-size:15px;font-weight:700;color:#2E7D32;border-bottom:2px solid #E8F5E9;">📋 문의 정보</td></tr>
              ${row('문의 유형', type)}
              ${row('회사명 / 성함', data.name)}
              ${row('연락처', `<a href="tel:${data.phone}" style="color:#2E7D32;text-decoration:none;font-weight:700;">${data.phone}</a>`)}
              ${row('이메일', data.email || '미입력')}
              ${row('문의 내용', data.memo || '없음')}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 30px 30px;text-align:center;">
            <a href="https://docs.google.com/spreadsheets/d/${SHEET_ID}"
               style="display:inline-block;background:#2E7D32;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-right:10px;">
              📊 구글시트 확인
            </a>
            <a href="tel:${data.phone}"
               style="display:inline-block;background:#FEE500;color:#000;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;">
              📞 바로 전화하기
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#f5f7fa;padding:16px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;">하늘매트 | 1877-2008 | www.skymat.kr</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    textBody = `[하늘매트 기업문의] 접수 (${receiptNo})\n\n유형: ${type}\n회사/이름: ${data.name}\n연락처: ${data.phone}\n이메일: ${data.email || '미입력'}\n내용: ${data.memo}`;
  } else {
    subject = `[하늘매트] 시공 상담 신청 - ${data.name}님 (${receiptNo})`;
    htmlBody = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Apple SD Gothic Neo',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f7fa">
    <tr><td align="center" style="padding:30px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#1565C0,#00B0FF);padding:30px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">🏠 하늘매트</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">새로운 시공 상담이 접수되었습니다</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 30px 16px;">
            <div style="background:#E3F2FD;border-left:4px solid #1565C0;border-radius:4px;padding:14px 16px;">
              <p style="margin:0;font-size:13px;color:#1565C0;font-weight:600;">📅 접수시간: ${dateStr} (${receiptNo})</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 30px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td colspan="2" style="padding-bottom:12px;font-size:15px;font-weight:700;color:#1565C0;border-bottom:2px solid #E3F2FD;">📋 신청자 정보</td></tr>
              ${row('이름', data.name)}
              ${row('연락처', `<a href="tel:${data.phone}" style="color:#1565C0;text-decoration:none;font-weight:700;">${data.phone}</a>`)}
              ${row('지역/아파트', data.address || '')}
              ${row('시공희망날짜', data.installDate || '')}
              ${row('평형타입/시공범위', data.areaType || '')}
              ${row('남기는말', data.memo || '없음')}
              ${row('샘플 희망여부', data.sample || '미선택')}
              ${data.sampleNote ? row('남기고 싶은 말', data.sampleNote) : ''}
              ${data.calcResult ? row('견적 계산기 결과', `<div style="color:#666;font-size:12px;">${data.calcResult}</div>`) : ''}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 30px 30px;text-align:center;">
            <a href="https://docs.google.com/spreadsheets/d/${SHEET_ID}"
               style="display:inline-block;background:#1565C0;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-right:10px;">
              📊 구글시트 확인
            </a>
            <a href="tel:${data.phone}"
               style="display:inline-block;background:#FEE500;color:#000;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;">
              📞 바로 전화하기
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#f5f7fa;padding:16px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;">하늘매트 | 1877-2008 | www.skymat.kr</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    textBody = `[하늘매트] 시공 상담 신청 접수 (${receiptNo})\n\n이름: ${data.name}\n연락처: ${data.phone}\n지역/아파트: ${data.address}\n희망일: ${data.installDate}\n범위: ${data.areaType}\n문의: ${data.memo || '없음'}`;
  }

  GmailApp.sendEmail(NOTIFY_EMAIL, subject, textBody, {
    htmlBody: htmlBody,
    name: SENDER_NAME
  });
}

/**
 * HTML 이메일 행 생성 헬퍼
 */
function row(label, value) {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;width:140px;vertical-align:top;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;font-weight:500;">${value}</td>
    </tr>`;
}

/**
 * 알림 발송 테스트 (알림톡 or SMS)
 * Apps Script 편집기에서 직접 실행 가능
 */
function testNotification() {
  const testData = {
    formType: 'consult',
    name: '홍길동(테스트)',
    phone: '010-1234-5678',
    address: '서울시 강남구 테헤란로 123',
    installDate: '2026-06-01',
    areaType: '34평형 / 거실+복도',
    sample: '✅ 희망',
    sampleNote: '600x600 샘플',
    memo: '알림톡 테스트 발송입니다.',
    calcResult: '[견적계산기] 34평형 → 예상 약 115장'
  };

  const mode = (KAKAO_PF_ID && KAKAO_TEMPLATE_CONSULT) ? '카카오 알림톡' : 'SMS';
  Logger.log('발송 방식: ' + mode);
  Logger.log('수신 번호: ' + ADMIN_PHONES.join(', '));

  const result = sendNotifications(testData, 'consult');
  Logger.log('테스트 결과: ' + result);
}
