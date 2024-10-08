const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const setDelay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

//Số lượng browser
const dataSets = ["user_data", "user_data_2"];

(async () => {
    for (const dataSet of dataSets) {
        const userDataDir = path.resolve(__dirname, `data/${dataSet}`);

        const browser = await puppeteer.launch({
            headless: false,
            userDataDir: userDataDir,
            defaultViewport: null,
            args: [
                '--window-size=300,700',
                '--disable-infobars',
                '--disable-notifications',
                '--disable-geolocation',
                `--disable-extensions-except=${path.join(__dirname, 'Telewebtoadrv2')}`,
                `--load-extension=${path.join(__dirname, 'Telewebtoadrv2')}`
            ],
        });
        openTool(browser)
    }

})();

const keywords = ["play", "mở", "launch", "go"];
async function openTool(browser) {
    const toolID = fs.readFileSync('toolID.json', 'utf-8');
    const parseToolID = JSON.parse(toolID, 'utf-8');
    const siteTool = Object.keys(parseToolID)

    for (const site of siteTool) {
        const nameTool = parseToolID[site]
        console.log("nameTool", nameTool)
        await clearToolData(nameTool.name);
        const page = await browser.newPage();

        await page.goto(`https://web.telegram.org/a/#${site}`, { waitUntil: 'networkidle2' });
        await setDelay(4000);

        const element = await page.$('#auth-qr-form');
        if (element) {
            console.log('Bạn chưa đăng nhập cho tài khoản cho browser này! Đợi 30s để đăng nhập.');
            await setDelay(30000);
            await page.goto(`https://web.telegram.org/a/#${site}`, { waitUntil: 'networkidle2' });
        }

        const buttons = await page.$$('button');

        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            const buttonText = await page.evaluate(el => el.textContent.trim().toLowerCase(), button);
            const isMatch = keywords.some(keyword => buttonText.includes(keyword.toLowerCase()));

            if (isMatch) {
                console.log(`Button ${i + 1}: "${buttonText}" chứa từ khóa.`);
                try {
                    // Nhấp vào button
                    await setDelay(2000);
                    await button.click();

                    const modal = await page.waitForSelector('.modal-container', { timeout: 3000 }).catch(() => undefined);
                    if (modal) {
                        const buttonConfirm = await page.waitForSelector('.modal-container .confirm-dialog-button', { timeout: 3000 }).catch(() => undefined);
                        if (buttonConfirm) await buttonConfirm.click();
                    }

                    await setDelay(2000);
                    const frames = page.frames();

                    const newFrame = frames[frames.length - 1];
                    const frameUrl = newFrame.url();
                    if (frameUrl) {
                        const startIndex = frameUrl.indexOf('#tgWebAppData=') + '#tgWebAppData='.length;
                        const endIndex = frameUrl.indexOf('&', startIndex);
                        if (startIndex !== -1 && endIndex !== -1) {
                            let query_id = frameUrl.substring(startIndex, endIndex);
                            query_id = decodeURIComponent(query_id);
                            console.log('Đã lấy được Query ID:', query_id);
                            await saveToJSON(nameTool.name, query_id);
                        } else {
                            console.log('Query ID not found in frameUrl.');
                            sendResponse({ query_id: null });
                        };
                    } else {
                        console.log("Không tìm thấy chuỗi user% trong URL của iframe.");
                    }

                    break;
                } catch (error) {
                    console.error(`Không thể nhấp vào button ${i + 1}: "${buttonText}". Lỗi:`, error);
                }
            }
        }

        // Đóng trang sau khi hoàn tất
        await page.close();
    }
    await browser.close();
}

async function saveToJSON(nameTool, data) {
    const filePath = path.join(__dirname, 'update_data.json');

    let jsonData = {};
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        jsonData = JSON.parse(fileContent);
    }

    if (!jsonData[nameTool]) {
        jsonData[nameTool] = { data: [], id: [] };
    }
    
    if (!jsonData[nameTool].data.includes(data)) {
        jsonData[nameTool].data.push(data);
    }

    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 4), 'utf-8');
    console.log(`Đã lưu dữ liệu vào tệp: ${filePath} với khóa là "${nameTool}"`);
}

async function clearToolData(nameTool) {
    const filePath = path.join(__dirname, 'update_data.json');

    let jsonData = {};
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        jsonData = JSON.parse(fileContent);
    }

    if (jsonData[nameTool]) {
        jsonData[nameTool] = { data: [], id: [] };
        console.log(`Đã làm trống dữ liệu của tool: ${nameTool}`);
    }

    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 4), 'utf-8');
}
