# Chico investment workbench

## Watchlist

- banner:
  - heading "Watchlist" [level=2]
  - text: Names · 1
  - button "Refresh":
    - img
- text: Search instruments
- img
- searchbox "Search instruments"
- list:
  - listitem:
    - button "Open investment record 宁德时代":
      - text: 宁德时代 SZSE:300750 395.3 −0.90%
      - img
    - list:
      - listitem: Related conversations 1
      - listitem:
        - button "archive"
        - button "Delete conversation “archive”":
          - img
      - listitem:
        - button "New conversation":
          - img
          - text: New conversation

## Default evidence

- banner:
  - text: Stock dossier
  - heading "宁德时代" [level=2]
  - text: SZSE:300750
  - button "Collapse investing details":
    - img
- tablist "Stock dossier":
  - tab "Evidence" [selected]
  - tab "Record"
- tabpanel "Evidence":
  - paragraph: Start a conversation; every source an answer draws on is listed here.

## Collapsed-details recovery

- banner:
  - heading "Watchlist" [level=2]
  - text: Names · 1
  - button "Expand investing details":
    - img
  - button "Refresh":
    - img
- text: Search instruments
- img
- searchbox "Search instruments"
- list:
  - listitem:
    - button "Open investment record 宁德时代":
      - text: 宁德时代 SZSE:300750 395.3 −0.90%
      - img
    - list:
      - listitem: Related conversations 1
      - listitem:
        - button "archive"
        - button "Delete conversation “archive”":
          - img
      - listitem:
        - button "New conversation":
          - img
          - text: New conversation

## Reopened record

- banner:
  - text: Stock dossier
  - heading "宁德时代" [level=2]
  - text: SZSE:300750
  - button "Collapse investing details":
    - img
- tablist "Stock dossier":
  - tab "Evidence"
  - tab "Record" [selected]
- tabpanel "Record":
  - text: Latest quote 395.30 CNY −0.90%
  - region "Price trend":
    - text: Price trend 2026-08-14
    - status: 395.3 -3.6 -0.90% CNY
    - text: O402.0 H410.2 L384.5 C395.3 Vol 44.9M MA5 395.2 MA10 387.6 MA20 369.7 MA60 369.2
    - group "Range":
      - button "1M"
      - button "3M"
      - button "6M" [pressed]
      - button "1Y"
      - button "All"
    - group "Lower pane":
      - button "Volume" [pressed]
      - button "MACD"
      - button "KDJ"
    - img "SZSE:300750 daily candles, 60 sessions, lower pane Volume. Arrow keys read one session at a time.": 350.0 400.0 450.0 395.3 2026-08-14
    - paragraph: 60 sessions · 2026-05-22 – 2026-08-14 · range 310.3–449.6 · as traded
  - term: Stance
  - definition: Watching
  - term: Position
  - definition: —
  - term: Chats
  - definition: "1"
  - text: My investment record
  - heading "Investment rationale and record" [level=3]
  - text: Entries · 0 Add a record Build a timeline that can be verified
  - button "Thesis" [pressed]
  - button "Decision"
  - button "Event"
  - textbox "Record a thesis, a decision, or an event…"
  - button "Record" [disabled]:
    - img
    - text: Record
  - img
  - paragraph: The chain is empty. A thesis written here comes back to be settled.

## Delete confirmation

- dialog "Delete conversation record?":
  - heading "Delete conversation record?" [level=2]
  - button "Cancel":
    - img
  - paragraph: “archive” will be removed from Investing and Sessions. Its log and source links in the investment record are retained. This version does not permanently delete logs.
  - button "Cancel"
  - button "Delete conversation record"

## After deleting the current conversation

- banner:
  - heading "Watchlist" [level=2]
  - text: Names · 1
  - button "Refresh":
    - img
- text: Search instruments
- img
- searchbox "Search instruments"
- list:
  - listitem:
    - button "Open investment record 宁德时代":
      - text: 宁德时代 SZSE:300750 395.3 −0.90%
      - img
