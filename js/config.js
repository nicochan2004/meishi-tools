// 名刺管理アプリ 設定ファイル
// README.md の手順に従って、下記2つの値を自分のGoogle Cloud Consoleで発行した値に置き換えてください。
window.MT_CONFIG = {
  // Google Cloud Vision API のAPIキー(HTTPリファラー制限を必ず設定すること)
  VISION_API_KEY: "AIzaSyDdOcD5baNcd0GHmM3bxG5mvxHISNXZ5KA",

  // OAuth 2.0 クライアントID(種類: ウェブアプリケーション)
  GOOGLE_CLIENT_ID: "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com",

  // Google Drive API に要求するスコープ(アプリが作成したファイルのみアクセス)
  DRIVE_SCOPE: "https://www.googleapis.com/auth/drive.file",

  // Drive上のアプリ専用フォルダ名
  DRIVE_FOLDER_NAME: "名刺管理アプリ",

  // OpenCV.js のCDN URL(docs.opencv.orgは環境によってはBot対策でブロックされるためjsDelivr経由を使用)
  OPENCV_JS_URL: "https://cdn.jsdelivr.net/npm/@techstark/opencv-js/dist/opencv.js",
};
