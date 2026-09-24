"""
Click through every screen in a headless browser and save screenshots.
Used to check the prototype end to end. Requires the API running on :8000
and `pip install playwright` (browser already installed in this environment).

    python3 frontend-app/tools/walkthrough.py [url]
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/bookme/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "shots")


async def main():
    os.makedirs(OUT, exist_ok=True)
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)

        async def shot(name):
            await page.wait_for_timeout(400)
            await page.screenshot(path=os.path.join(OUT, f"{name}.png"))
            print("shot", name)

        await page.goto(URL)
        await page.wait_for_selector("[data-find]")
        print("source:", await page.inner_text("#demoSource"))
        await shot("00-search")
        # A sentence: constraints are read out of it, the rest is the craving
        await page.fill("[data-q]", "Cheap Korean for 4, one's vegan")
        print("parsed:", (await page.inner_text("[data-understood]")).replace("\n", " | "), "->", await page.inner_text("[data-find]"))
        await page.fill("[data-q]", "")
        await page.click("[data-suggest] >> nth=0")  # "Spicy noodles"
        await page.wait_for_selector("[data-understood] .pill")
        await shot("00b-search-typed")
        print("parsed:", (await page.inner_text("[data-understood]")).replace("\n", " | "), "->", await page.inner_text("[data-find]"))
        await page.click("[data-toggle]")
        await shot("00c-search-table")
        await page.click("[data-toggle]")
        await page.click("[data-find]")
        await page.wait_for_selector(".r-card")
        await shot("01-home")
        dish = await page.query_selector(".dish-row")
        print("dish results:", len(await page.query_selector_all(".dish-row")))
        if dish:
            await dish.click()
        else:
            await page.click(".r-card >> nth=0")
        await page.wait_for_selector(".seats-card")
        await shot("02-restaurant")
        await page.click("[data-reserve]")
        await page.wait_for_selector(".sheet")
        await shot("03-reserved")
        await page.click("[data-checkin]")
        await page.wait_for_selector(".geo-confirmed", timeout=4000)  # simulated check-in delay
        await shot("03b-checked-in")
        await page.click("[data-menu-early]")
        await page.wait_for_selector(".dish-card")
        await shot("04-menu")

        # add the first two orderable dishes
        incs = await page.query_selector_all("[data-inc]")
        await incs[0].click()
        await page.wait_for_timeout(150)
        incs = await page.query_selector_all("[data-inc]")
        await incs[1].click()
        await page.wait_for_timeout(150)
        why = await page.query_selector("[data-why]")
        if why:
            await why.click()
        await shot("05-menu-cart")

        await page.click("[data-review]")
        await page.wait_for_selector("[data-send]")
        await shot("06-order")
        swap = await page.query_selector("[data-swap]")
        if swap:
            await swap.click()
            await shot("06b-order-swapped")
        await page.click("[data-send]")
        await page.wait_for_selector("[data-pay]", timeout=8000)
        await shot("07-eta")
        print("eta:", await page.inner_text(".est-title"))

        await page.click("[data-pay]")
        await page.wait_for_selector("[data-paynow]")
        await shot("08-pay")
        await page.click("[data-split=item]")
        await shot("08b-pay-by-item")
        await page.click("[data-paynow]")
        await page.wait_for_selector("[data-review]")
        await shot("09-paid")
        await page.click("[data-review]")
        await page.wait_for_selector("[data-star]")
        await page.click("[data-star='5']")
        await page.fill("[data-text]", "Great night. The gluten-free filter meant nobody had to ask.")
        await page.click("[data-skip] >> nth=0")
        await shot("10-review")
        await page.click("[data-submit]")
        await page.wait_for_selector("[data-home]")
        await shot("11-thanks")

        # Ops view
        await page.click("#demoToggle")
        await page.click(".demo-seg button[data-mode=owner]")
        await page.wait_for_selector(".hero-card", timeout=8000)
        await page.click("#demoToggle")
        await shot("12-ops-tonight")
        await page.click("[data-otab=forecast]")
        await page.wait_for_selector(".chart svg")
        await shot("13-ops-forecast")
        await page.click("[data-otab=reorder]")
        await page.wait_for_selector(".table")
        await shot("14-ops-reorder")

        # Back to diner via the demo panel, with a different diner
        await page.click("#demoToggle")
        await page.click(".demo-seg button[data-mode=diner]")
        await page.select_option("#demoDiner", index=5)
        await page.click("[data-jump=menu]")
        await page.wait_for_selector(".dish-card")
        await page.click("#demoToggle")
        await shot("15-menu-other-diner")

        await browser.close()
    print("\n".join(errors) if errors else "no console errors")
    return errors


if __name__ == "__main__":
    errs = asyncio.run(main())
    sys.exit(1 if [e for e in errs if "pageerror" in e] else 0)
