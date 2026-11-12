import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:28301"
OUT = sys.argv[1]

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{URL}/login")
    page.fill("input[name=email]", "a@w.kr")
    page.click("text=들어가기")
    page.wait_for_url(f"{URL}/")
    page.wait_for_selector("text=반가워요")
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/01-home.png", full_page=True)
    for path, name in [("/friends", "09-friends"), ("/me", "10-me")]:
        page.goto(URL + path)
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    page.goto(f"{URL}/")
    page.wait_for_selector("text=청년부 찬양팀")
    page.click("text=청년부 찬양팀 >> nth=-1")
    page.click("text=공간 관리")
    page.wait_for_selector("text=사람 초대")
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/06-manage.png", full_page=True)
    page.click("text=초대하기")
    page.wait_for_timeout(800)
    page.screenshot(path=f"{OUT}/12-invite-sheet.png")
    page.keyboard.press("Escape")
    page.goto(f"{URL}/notifications")
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{OUT}/08-notifs.png", full_page=True)
    print("errors:", errors)
    browser.close()
