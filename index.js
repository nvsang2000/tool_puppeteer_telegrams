const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const setDelay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

//Số lượng browser
const dataSets = ["user_data", "user_data_2", "user_data_3", "user_data_4", "user_data_5"];

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
        //checkBrowserTele(browser)
    }

})();

//keywords tìm kiếm nút play
//Mở all tool hoặc tự đặt tên tool riêng.
const keywords = ["play", "open", "mở", "launch", "go"];
const selectIDs = []
async function openTool(browser) {
    const toolID = fs.readFileSync('toolID.json', 'utf-8');
    const parseToolID = JSON.parse(toolID, 'utf-8');

    let siteTool
    if (selectIDs?.length !== 0) siteTool = selectIDs
    else siteTool = Object.keys(parseToolID)


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
                    await Promise.all([
                        await button.click(),
                        await setDelay(4000)
                    ]).catch((err) => {
                        console.log(err)
                    });

                    const modal = await page.waitForSelector('.modal-container', { timeout: 6000 }).catch(() => undefined);
                    if (modal) {
                        const buttonConfirm = await page.waitForSelector('.modal-container .confirm-dialog-button', { timeout: 6000 }).catch(() => undefined);
                        if (buttonConfirm) {
                            await buttonConfirm.click();
                        }
                    }

                    await setDelay(8000)
                    await updateRequestID(nameTool, page)
                    break;
                } catch (error) {
                    console.error(`Không thể nhấp vào button ${i + 1}: "${buttonText}". Lỗi:`, error);
                }
            }
        }

        await page.close();
    }
    await browser.close();
}

async function updateRequestID(nameTool, page) {
    let frames;
    frames = page.frames();
    if(!frames) {
        await setDelay(20000)
        frames = page.frames();
    }
    const newFrame = frames[0];
    const frameUrl = newFrame.url();
    if (frameUrl) {
        const requestID = await checkIframeAndGetQueryId(page)
        await saveToJSON(nameTool.name, requestID.query_id);
    } else {
        console.log("Không tìm thấy chuỗi user% trong URL của iframe.");
    }
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


async function checkIframeAndGetQueryId(page) {
    // Hàm kiểm tra và lấy query_id trong Puppeteer
    return await page.evaluate(async () => {
        function checkIframe(retries = 3) {
            return new Promise((resolve) => {
                const game = document.querySelector('iframe');

                if (game) {
                    const src = game.getAttribute('src');
                    console.log('SRC found:', src);

                    if (src) {
                        const startIndex = src.indexOf('#tgWebAppData=') + '#tgWebAppData='.length;
                        const endIndex = src.indexOf('&', startIndex);

                        if (startIndex !== -1 && endIndex !== -1) {
                            let query_id = src.substring(startIndex, endIndex);
                            query_id = decodeURIComponent(query_id);
                            console.log('Đã lấy được Query ID:', query_id);
                            resolve({ query_id });
                        } else {
                            console.log('Query ID not found in src.');
                            resolve({ query_id: null });
                        }
                    } else {
                        console.log('Không tìm thấy src trong iframe.');

                        if (retries > 0) {
                            console.log(`Thử lại... (${3 - retries + 1})`);
                            setTimeout(() => resolve(checkIframe(retries - 1)), 500);
                        } else {
                            resolve({ query_id: null });
                        }
                    }
                } else {
                    console.log('Iframe not found.');

                    if (retries > 0) {
                        console.log(`Thử lại... (${3 - retries + 1})`);
                        setTimeout(() => resolve(checkIframe(retries - 1)), 500);
                    } else {
                        resolve({ query_id: null });
                    }
                }
            });
        }

        return await checkIframe();
    });
}

async function checkBrowserTele(browser) {
    const page = await browser.newPage();

    await page.goto(`https://web.telegram.org`, { waitUntil: 'networkidle2' });
    const element = await page.$('#auth-qr-form');
    if (element) {
        console.log('Bạn chưa đăng nhập cho tài khoản cho browser này! Đợi 30s để đăng nhập.');
        await setDelay(60000);
    }
}