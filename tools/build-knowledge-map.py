"""Build a title-based prototype snapshot. Run from the repository root; requires bs4.
Rules classify titles only, never imply full-text evidence. Inspect unclassified output.
"""
import json, re
from pathlib import Path
from bs4 import BeautifulSoup
TOPICS = [
 ('ai','Artificial Intelligence','Model competition, adoption, robotics, and the economics of AI.',r'\bAI\b|artificial intelligence|Anthropic|OpenAI|DeepSeek|Gemini|hyperscaler|robot|Claude|Big Tech|DeepMind|Nvidia|data cent|data wall|AI!!!!|Alphabet|Tech.s .*Cash|Tech.s Trillion|Instinct|Nscale|CoreWeave|Meta.s Muse|Microsoft|ElevenLabs', '#667a62'),
 ('credit','Credit','Corporate funding, private credit, insurance capital, and debt-market stress.',r'bond|debt|borrow|credit|financing|finance the|financing.*AI|AI.*financing|balance sheet|insur|reinsurance|defaults|loan|mortgage|crowding out|crowding Out|creditors|interest bill|Treasury|JGB|yields|repo market', '#9b7963'),
 ('japan','Japan','Trading houses, corporate restructuring, governance, and Japanese markets.',r'Japan|Japanese|Nidec|Sogo Shosha|trading (?:house|companies)|Mitsui|Marubeni|ITOCHU|Kakaku|Dentsu|Kobayashi|Prudential.s Japan|Furukawa|Topix|Aozora|Niterra|Nippon|Rakuten|Toshiba|Toppan|Panasonic|Kawasaki|Uniqlo|Fast Retailing|Seven & i|Shionogi|Park24|Mitsubishi|Hikari|Tokio Marine|\bBoJ\b|\bYen\b', '#a18c4b'),
 ('deals','Deals','Takeovers, listings, shareholder control, and corporate governance.',r'IPO|listing|take.private|takeover|buyout|merger|M&A|dealmaking|deal\b|acquir|acquisition|to buy|to sell|sale\b|bid\b|bidder|offer\b|stake|voting|shareholder|board|leadership change|chief executive|sign off|delisting|antitrust|restructur|to float|consolidate control|parent.child|disclosure|SEC|activist|Hires.*CEO', '#99889f'),
 ('investing','Investment & Funds','Portfolio construction, equity valuations, fund strategies, and capital allocation.',r'investor|investing|investment|portfolio|equiti|stock|fund\b|funds\b|capital.*letter|quarterly commentary|annual letter|ETF|valuation|Buffett|Berkshire|dividend|buyback|capital cycle|financial results|compounder|cash machine|best.performing|underperformed|Polymarket|Situational Awareness|Citadel|Millennium|Jane Street|Wall Street.s.*Bears|JPMorgan.*Conviction|Reasons to Be Bullish', '#687f90'),
 ('macro','Macro','Sovereign debt, interest rates, monetary policy, currencies, and economic shocks.',r'Treasury|JGB|sovereign|rates|\bFed\b|\bBoE\b|central bank|Bank of Japan|\bBoJ\b|yen|yields|bond (?:sell|rout|market)|global bond|US.*debt|economy|economics|macroeconomic|productivity|fiscal|inflation|interest bill|currency|monetary|world.*debt|Hike\?|Iran Shock|Energy Shock|Absorb the Iran|reserve asset|HKD|Hong Kong Dollar|creditors|Bessent.*Buyback', '#88834f'),
 ('infrastructure','Hardware','Compute capacity, semiconductor supply, data centres, and physical constraints.',r'chip|semiconductor|Nvidia|Broadcom|data cent|data center|AI build|AI hub|AI capex|ASML|TSMC|Micron|memory|hyperscaler|compute|server|hardware|Nscale|CoreWeave|power bottleneck|Tech.s Trillion|capital.intensity|AI Exposure Off Balance', '#628e8a'),
 ('geopolitics','Geopolitics','Cross-border tensions, conflict, elections, and the policy environment for business.',r'China|Chinese|Iran|war\b|warfare|export|\btrade\b|tariff|Trump|White House|Bolsonaro|election|midterm|Falkland|Houthi|Ethiopia|civil war|Venezuel|F-35|Saudi Arabia|US Pressure|US and China|Across Borders|sub.capital|offshore trust', '#b18174'),
 ('energy','Commodities','Oil, shipping, mining, batteries, and resource constraints.',r'oil|energy|Aramco|diesel|tanker|shipping|electricity|power bottleneck|battery|batteries|\bgold\b|miner|mining|Glencore|iron ore|utility|climate|CATL|motor oil|shipbuilding', '#a1936d'),
 ('consumer','Consumers','Retail competition, luxury, brands, and changing consumer demand.',r'Uniqlo|Retail|Seven & i|7-Eleven|Shein|Nike|McDonald|LVMH|luxury|Kering|Armani|L.Oréal|Rolex|Ferrari|Oura|Starbucks|FamilyMart|Tesco|Lidl|Sainsbury|Morrisons|Songmont|Pane Accessory|cigarette|GoPro|iPhone|WhatsApp|Tencent Launches Payments', '#b18a9a'),
 ('banking','Financials','Bank business models, fintech, trading, and financial-system resilience.',r'\bbanks?\b|banking|Monzo|Revolut|Nubank|HSBC|Hang Seng|Zilch|Jane Street|hedge fund|basis trade|repo market|trading firm|block trad|Treasury Exposures|Polymarket|FINI|interbank|financial institutions|offshore trust', '#728796'),
 ('society','Work & daily life','Employment, demographic change, housing, culture, and everyday life.',r'jobs|workers|population|ageing|children|immigration|housing|homebuilder|affordability|law firm|Big Law|billable|fee model|humanity|mind|Cindy Sherman|Antigone|Oxbridge|West Village|lonely|Case Method|Gun Violence|Taxpayer|Formal Dinners|Future Is for Everyone|Abundance Delusion|Robot Apocalypse', '#9a927e'),
 ('health','Healthcare','Drug development, healthcare businesses, and medical uses of AI.',r'drug|Mounjaro|weight.loss|Novo\b|pharma|health|medical|disease|cancer|Shionogi|Recordati|Oura', '#8b9c81'),
 ('safety','AI Safety','Reliability, safety, security, and technical foundations.',r'safety|risk factors|rogue|concerning|wrong answers|hacked|breach|SSH|execution environments|Raspberry Pi|autonomy|autonomous|mathematics|proof problem|pause on cutting|risk management of generative|AI Should Learn|Open-Model|open.*AI models|AI Openness|Slopfiling', '#94868b'),
]
soup=BeautifulSoup(Path('articles.html').read_text(),'html.parser')
articles=[]
for li in soup.select('.article-list > li'):
    note=li.select_one('.source-note'); source=note.get_text(' ',strip=True) if note else ''
    if note: note.extract()
    a=li.find('a'); title=li.get_text(' ',strip=True)
    date=li.find_parent('li',class_='entry').find('time')['datetime']
    tags=[t[0] for t in TOPICS if re.search(t[3],title,re.I)]
    articles.append(dict(title=title,url=a['href'] if a else '',source=source,date=date,topics=tags))
# Editorial tags for titles too ambiguous for the conservative lexical rules.
extra={'GoTo Slides as Indonesia Exchange Removes 50 Rupiah Price Floor': ['investing'], 'Wall Street Warns Trading Boom Is Losing Steam': ['banking'], 'Sullivan & Cromwell Hires Team of Kirkland Partners in Private Equity Push': ['deals', 'society'], 'Hike? Psych': ['macro'], 'The Drill — September 30, 2026': ['energy'], 'ITOCHU Corporation - The Trading House That Refuses to Shout': ['investing'], "Tech's Operating Cash Flows Are Expected to Soar, but Its Customers' Are Not?": ['ai', 'investing'], 'Learning by the Case Method': ['society'], 'Anthropic’s Ugly Math': ['ai', 'investing'], "Tech's Trillion-Dollar Internal Inconsistency": ['ai', 'infrastructure'], 'The Crisis at Big Law Powerhouse Weil': ['society'], 'Abridged - Capital Cycle IQ & Forensic Files on the Big 5 Hyperscalers (MSFT, AMZN, ORCL, META, GOOG)': ['ai', 'investing'], 'The Sogo Shosha — An Insider’s Perspective': ['japan'], 'Beyond the AI Abundance Delusion': ['ai', 'society'], 'The Teaser Period: Why the AI Boom Is Hitting a Reset Wall': ['ai', 'investing'], 'Enter Slopfiling': ['safety', 'ai'], 'Shall We Repeal the Laws of Economics – Part III': ['macro'], 'Jane Street Has Paid Up Large to Avoid Its Numbers Leaking Out': ['banking'], 'Anthropic and the Golden Rules of Business': ['ai', 'investing'], 'Why Tata’s Boardroom Is at War': ['deals'], 'How I Think About Investing: Two Games': ['investing'], 'This Is Good for AI!!!! Aaargh!!!!': ['ai'], 'The Civil War in Data Centre Alley': ['infrastructure'], 'Anthropic Tells Investors It Will Be Profitable for Second Straight Quarter': ['investing'], 'Situational Awareness Builds Relationships with New Brokers as It Attempts Rebound': ['investing'], 'The Future Is for Everyone': ['society']}
for article in articles:
 article['topics']=sorted(set(article['topics']+extra.get(article['title'],[])))
# Figurative headlines do not establish geopolitical conflict.
for article in articles:
 if article['title'] in ['The Civil War in Data Centre Alley', 'Why Tata’s Boardroom Is at War']:
  article['topics']=[t for t in article['topics'] if t != 'geopolitics']
unclassified=[a['title'] for a in articles if not a['topics']]
if unclassified: print('Unclassified:',unclassified)
if unclassified:
 TOPICS.append(('other','Further reading','Titles needing full-text review before more precise classification.','', '#92958e'))
 for a in articles:
  if not a['topics']:a['topics']=['other']
data=dict(basis='Title-based prototype; full texts have not been analyzed.',topics=[dict(id=t[0],label=t[1],summary=t[2],color=t[4]) for t in TOPICS],articles=articles)
Path('knowledge-data.js').write_text('window.KNOWLEDGE_DATA = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n')
print('Articles:',len(articles),'Dates:',min(a['date'] for a in articles),max(a['date'] for a in articles))
print(sorted([(t[1],sum(t[0] in a['topics'] for a in articles)) for t in TOPICS],key=lambda x:-x[1]))
