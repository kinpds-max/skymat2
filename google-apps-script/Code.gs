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

// ★ 솔라피(SOLAPI) 설정 (이전 정보 연동 완료) ★
const SOLAPI_API_KEY = 'NCSEI0BPHUGSGJQE';
const SOLAPI_API_SECRET = '636FK1NIGBC9GQKTEQGU67XG2IZP9ADK';

// [중요] 발신 전화번호 (솔라피에 서류 등록 및 승인 완료된 번호)
const SENDER_PHONE = '01075471197'; 

// [중요] 문자를 받을 전화번호 (상담 알림을 전송받을 대표 휴대폰 번호)
const ADMIN_PHONE = '07080578500';  


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

    // 2) 솔라피 문자 발송
    let smsResult = '솔라피 설정 미완료';
    if (SOLAPI_API_KEY && SOLAPI_API_KEY !== 'YOUR_SOLAPI_API_KEY') {
      smsResult = sendNotificationSms(data, formType);
    }

    // 3) Google Sheets에 저장 (문자 전송 결과도 함께 기록)
    const receiptNo = saveToSheet(data, smsResult, formType);

    // 4) 이메일 알림 발송 (두 개의 메일 주소로 발송됨)
    if (NOTIFY_EMAIL) {
      sendNotificationEmail(data, receiptNo, formType);
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
 * YouTube 쇼츠 최신 6개 반환 (1시간 캐시)
 * - YouTube RSS → 최신 20개 영상 추출
 * - 각 영상 /shorts/ID 접근 시 200이면 Shorts, 303이면 일반영상
 */
function getShortsData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('shorts_v1');
  if (cached) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  const channelId = 'UCJnWOugRSSv3Oqzir2FgNRA';
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
      .slice(0, 20);

    const shortsIds = [];
    for (var i = 0; i < videoIds.length; i++) {
      if (shortsIds.length >= 6) break;
      try {
        var resp = UrlFetchApp.fetch('https://www.youtube.com/shorts/' + videoIds[i], {
          followRedirects: false,
          muteHttpExceptions: true
        });
        if (resp.getResponseCode() === 200) shortsIds.push(videoIds[i]);
      } catch (err) {}
    }

    var json = JSON.stringify({ status: 'ok', ids: shortsIds });
    cache.put('shorts_v1', json, 3600);
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', ids: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
  const sheetName = formType === 'biz' ? '기업문의' : '상담신청';
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
 * 솔라피 (SOLAPI) 알림 문자 발송
 */
function sendNotificationSms(data, formType) {
  const url = 'https://api.solapi.com/messages/v4/send';
  const authHeader = generateSolapiAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET);
  
  let textMessage = '';
  if (formType === 'biz') {
    textMessage = `[하늘매트 기업협력 문의]
새로운 비즈니스 제안이 접수되었습니다.

• 유형: ${data.bizType || data.type || ''}
• 회사명/성함: ${data.name || ''}
• 연락처: ${data.phone || ''}
• 이메일: ${data.email || '미입력'}
• 문의내용: ${data.memo || ''}`;
  } else {
    textMessage = `[하늘매트 상담신청]
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

  const payload = {
    message: {
      to: ADMIN_PHONE,
      from: SENDER_PHONE,
      text: textMessage
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: authHeader
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();
    
    try {
      const res = JSON.parse(responseText);
      if (res.errorCode) {
        return '발송 실패: [' + res.errorCode + '] ' + res.errorMessage;
      } else if (res.groupId || res.messageId) {
        return '발송 성공 (그룹ID: ' + (res.groupId || res.messageId) + ')';
      }
      return responseText;
    } catch (e) {
      return responseText;
    }
  } catch (e) {
    return '요청 에러: ' + e.toString();
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
 * 권한 승인 및 문자 발송 테스트를 위한 전용 함수
 */
function testSms() {
  const testData = {
    formType: 'consult',
    name: '홍길동(테스트)',
    phone: '010-1234-5678',
    address: '서울시 강남구 테헤란로 123',
    installDate: '2026-06-01',
    areaType: '34평형 / 거실+복도',
    sample: '✅ 희망',
    sampleNote: '600x600 샘플',
    memo: '솔라피 문자 테스트 발송입니다.',
    calcResult: '[견적계산기] 34평형 → 예상 약 115장'
  };
  
  if (SOLAPI_API_KEY === 'YOUR_SOLAPI_API_KEY') {
    Logger.log('오류: SOLAPI_API_KEY 설정을 먼저 완료해 주세요.');
    return;
  }
  
  const result = sendNotificationSms(testData, 'consult');
  Logger.log('테스트 발송 결과: ' + result);
}
