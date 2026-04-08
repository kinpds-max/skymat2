/**
 * 하늘매트 홈페이지 - 상담 신청 처리 스크립트
 * Google Apps Script Web App
 *
 * [설정 방법]
 * 1. https://script.google.com 에서 새 프로젝트 생성
 * 2. 이 코드를 붙여넣기
 * 3. SHEET_ID, NOTIFY_EMAIL 수정
 * 4. 배포 → 새 배포 → 웹 앱
 *    - 액세스 권한: 모든 사용자
 *    - 다음으로 실행: 나 (본인 계정)
 * 5. 배포 URL을 복사하여 js/main.js 상단의 APPS_SCRIPT_URL 에 붙여넣기
 */

// ★ 여기에 Google Sheets ID를 입력하세요 ★
// 구글시트 주소: https://docs.google.com/spreadsheets/d/【여기가 ID】/edit
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';

// ★ 상담 알림을 받을 이메일 주소 ★
const NOTIFY_EMAIL = 'your-email@gmail.com';

// ★ 발신자 이름 ★
const SENDER_NAME = '하늘매트 홈페이지';


/**
 * POST 요청 처리 - 폼 데이터 수신
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // 1) Google Sheets에 저장
    saveToSheet(data);

    // 2) 이메일 발송
    sendNotificationEmail(data);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
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
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok', message: '하늘매트 Apps Script 정상 작동 중' }))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Google Sheets에 데이터 저장
 */
function saveToSheet(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('상담신청');

  // 시트가 없으면 생성
  if (!sheet) {
    sheet = ss.insertSheet('상담신청');
    // 헤더 행 추가
    const headers = [
      '접수번호', '접수시간', '이름', '연락처',
      '주소', '상세주소', '시공희망날짜', '평형타입/시공범위',
      '남기는말', '샘플희망여부', '원하는매트사이즈', '처리상태'
    ];
    sheet.appendRow(headers);

    // 헤더 스타일
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1565C0');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // 접수번호 생성 (날짜기반)
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const receiptNo = `SM-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${String(sheet.getLastRow()).padStart(4,'0')}`;

  // 데이터 행 추가
  sheet.appendRow([
    receiptNo,
    now,                                          // 접수시간
    data.name || '',                              // 이름
    data.phone || '',                             // 연락처
    data.addr1 || '',                             // 주소
    data.addr2 || '',                             // 상세주소
    data.installDate || '',                       // 시공희망날짜
    data.areaType || '',                          // 평형타입/시공범위
    data.memo || '',                              // 남기는말
    data.sample === 'yes' ? '✅ 샘플 희망' : '❌ 샘플 불필요',  // 샘플희망여부
    data.sampleNote || '',                        // 원하는매트사이즈
    '📬 접수완료'                                  // 처리상태
  ]);

  // 방금 추가한 행 서식
  const lastRow = sheet.getLastRow();
  const dataRange = sheet.getRange(lastRow, 1, 1, 12);
  dataRange.setVerticalAlignment('middle');
  dataRange.setWrap(true);

  // 접수번호 열 강조
  sheet.getRange(lastRow, 1).setBackground('#E3F2FD').setFontWeight('bold');

  return receiptNo;
}


/**
 * 이메일 알림 발송
 */
function sendNotificationEmail(data) {
  const now = new Date();
  const dateStr = now.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'long'
  });

  const subject = `[하늘매트] 시공 상담 신청 - ${data.name}님 (${data.phone})`;

  // HTML 이메일 본문
  const htmlBody = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Apple SD Gothic Neo',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f7fa">
    <tr><td align="center" style="padding:30px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);">

        <!-- 헤더 -->
        <tr>
          <td style="background:linear-gradient(135deg,#1565C0,#00B0FF);padding:30px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">🏠 하늘매트</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">새로운 시공 상담이 접수되었습니다</p>
          </td>
        </tr>

        <!-- 접수 알림 -->
        <tr>
          <td style="padding:24px 30px 16px;">
            <div style="background:#E3F2FD;border-left:4px solid #1565C0;border-radius:4px;padding:14px 16px;">
              <p style="margin:0;font-size:13px;color:#1565C0;font-weight:600;">📅 접수시간: ${dateStr}</p>
            </div>
          </td>
        </tr>

        <!-- 신청자 정보 -->
        <tr>
          <td style="padding:0 30px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td colspan="2" style="padding-bottom:12px;font-size:15px;font-weight:700;color:#1565C0;border-bottom:2px solid #E3F2FD;">📋 신청자 정보</td></tr>
              ${row('이름', data.name)}
              ${row('연락처', `<a href="tel:${data.phone}" style="color:#1565C0;text-decoration:none;font-weight:700;">${data.phone}</a>`)}
              ${row('주소', `${data.addr1 || ''} ${data.addr2 || ''}`.trim())}
              ${row('시공희망날짜', data.installDate || '')}
              ${row('평형타입/시공범위', data.areaType || '')}
              ${row('남기는말', data.memo || '없음')}
              ${row('샘플 희망여부', data.sample === 'yes'
                ? '<span style="color:#2e7d32;font-weight:600;">✅ 샘플 희망</span>'
                : '<span style="color:#c62828;">❌ 샘플 불필요</span>')}
              ${data.sampleNote ? row('원하는 매트 사이즈', data.sampleNote) : ''}
            </table>
          </td>
        </tr>

        <!-- 액션 버튼 -->
        <tr>
          <td style="padding:0 30px 30px;text-align:center;">
            <a href="https://docs.google.com/spreadsheets/d/${SHEET_ID}"
               style="display:inline-block;background:#1565C0;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-right:10px;">
              📊 구글시트 확인하기
            </a>
            <a href="tel:${data.phone}"
               style="display:inline-block;background:#FEE500;color:#000;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;">
              📞 바로 전화하기
            </a>
          </td>
        </tr>

        <!-- 푸터 -->
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

  // 일반 텍스트 본문 (HTML 미지원 클라이언트용)
  const textBody = `
[하늘매트] 시공 상담 신청 접수

접수시간: ${dateStr}

■ 이름: ${data.name}
■ 연락처: ${data.phone}
■ 주소: ${data.addr1 || ''} ${data.addr2 || ''}
■ 시공희망날짜: ${data.installDate}
■ 평형타입/시공범위: ${data.areaType}
■ 남기는말: ${data.memo || '없음'}
■ 샘플 희망여부: ${data.sample === 'yes' ? '샘플 희망' : '샘플 불필요'}
■ 원하는 매트 사이즈: ${data.sampleNote || '없음'}

구글시트 확인: https://docs.google.com/spreadsheets/d/${SHEET_ID}
`.trim();

  GmailApp.sendEmail(NOTIFY_EMAIL, subject, textBody, {
    htmlBody: htmlBody,
    name: SENDER_NAME
  });

  // 신청자에게 확인 이메일 발송 (신청자 이메일이 있을 경우)
  if (data.email) {
    sendConfirmEmail(data);
  }
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
 * 신청자 확인 이메일 (선택사항)
 */
function sendConfirmEmail(data) {
  const subject = '[하늘매트] 상담 신청이 접수되었습니다';
  const htmlBody = `
<body style="font-family:sans-serif;padding:20px;">
  <h2 style="color:#1565C0;">안녕하세요, ${data.name}님!</h2>
  <p>하늘매트 시공 상담 신청이 정상적으로 접수되었습니다.<br>
  담당자가 영업일 기준 1~2일 내에 연락드리겠습니다.</p>
  <p>문의: <strong>1877-2008</strong></p>
  <hr>
  <p style="color:#999;font-size:12px;">하늘매트 | www.skymat.kr</p>
</body>`;

  GmailApp.sendEmail(data.email, subject, '', { htmlBody, name: SENDER_NAME });
}
