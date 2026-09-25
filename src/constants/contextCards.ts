import type { CategoryId } from './categories';

export interface ContextCardData {
  category: CategoryId;
  headline: string;
  body: string;
  sourceLabel: string;
  sourceUrl: string;
}

// Feature 6: short explanations of WHY the price of a staple moves.
//
// Deliberately static and deliberately structural. Two reasons:
//
// 1. There's no free API that returns "here is why eggs cost more this
//    month" — that's journalism, not data. Writing it by hand and citing
//    a real agency is honest; scraping headlines and presenting them as
//    analysis would not be.
// 2. Anything phrased as "prices are up 30% right now" is wrong within
//    months and there's no build step to catch it. So each card explains
//    a mechanism that stays true — why this item is volatile at all —
//    while the live BLS figures elsewhere in the app supply the current
//    numbers. The two halves answer different questions on purpose.
//
// Every sourceUrl below was checked and returns 200. If you add a card,
// check yours too — a dead "Source:" link is worse than no card.
export const CONTEXT_CARDS: ContextCardData[] = [
  {
    category: 'eggs',
    headline: 'Why egg prices spike so suddenly',
    body: "Egg supply is unusually fragile. Outbreaks of avian influenza lead to whole flocks being culled, and a replacement hen doesn't start laying for roughly four to six months. So supply falls in days but recovers over seasons — which is why egg prices tend to jump sharply and then drift down slowly, rather than moving gradually in either direction.",
    sourceLabel: 'USDA APHIS — Avian Influenza',
    sourceUrl: 'https://www.aphis.usda.gov/livestock-poultry-disease/avian/avian-influenza',
  },
  {
    category: 'gas',
    headline: 'Why gas prices change week to week',
    body: 'The cost of crude oil is the single biggest piece of what you pay at the pump, so global oil markets show up on the local sign within days. On top of that, refineries switch to a cleaner, more expensive summer blend each spring and shut down for maintenance around the same time — which is why prices often climb heading into summer even when nothing dramatic has happened.',
    sourceLabel: 'U.S. Energy Information Administration',
    sourceUrl: 'https://www.eia.gov/energyexplained/gasoline/factors-affecting-gasoline-prices.php',
  },
  {
    category: 'ground_beef',
    headline: 'Why beef reacts slowly to demand',
    body: 'Cattle take roughly two to three years to go from breeding to market, so ranchers cannot quickly add supply when prices rise. Drought makes it worse: poor pasture pushes ranchers to sell off breeding cows, which lowers prices briefly and then leaves fewer calves for years afterward. Beef prices therefore move in long cycles rather than short swings.',
    sourceLabel: 'USDA ERS — Cattle & Beef',
    sourceUrl: 'https://www.ers.usda.gov/topics/animal-products/cattle-beef',
  },
  {
    category: 'chicken_breast',
    headline: 'Why chicken is steadier than beef',
    body: 'A broiler chicken reaches market weight in about six to seven weeks, compared with years for cattle. Producers can respond to demand in a single season, so supply shortages correct much faster. This is a good item to compare against beef on the dashboard: the same feed-cost pressures hit both, but only one can adjust quickly.',
    sourceLabel: 'USDA ERS — Poultry & Eggs',
    sourceUrl: 'https://www.ers.usda.gov/topics/animal-products/poultry-eggs',
  },
  {
    category: 'milk',
    headline: 'Why milk prices vary by region',
    body: "Milk is heavy, perishable, and has to be processed within days, so it can't be shipped far to chase a better price the way grain can. That keeps dairy markets regional, and it's part of why the price near you can differ noticeably from the national average even in a calm month. Feed costs are the other main driver, since they set what it costs a farm to produce each gallon.",
    sourceLabel: 'USDA AMS — Dairy Programs',
    sourceUrl: 'https://www.ams.usda.gov/rules-regulations/moa/dairy',
  },
  {
    category: 'coffee',
    headline: 'Why coffee follows the weather abroad',
    body: 'Almost all coffee sold in the U.S. is imported, with Brazil and Vietnam the two largest producers. A drought or frost in either one moves the global price, and that shows up on American shelves months later once existing inventory sells through. Shipping costs and import policy add to it. Weather thousands of miles away matters more here than anything local.',
    sourceLabel: 'USDA ERS — Food Price Outlook',
    sourceUrl: 'https://www.ers.usda.gov/data-products/food-price-outlook',
  },
  {
    category: 'bread',
    headline: 'Why cheaper wheat rarely means cheaper bread',
    body: 'Farmers receive only about 15 cents of every dollar Americans spend on food at home — the rest covers processing, packaging, transport, labor, and the store itself. For a loaf of bread the wheat is a small slice of that. So when you hear grain prices fell, bread often barely moves: most of what you paid was never about the wheat.',
    sourceLabel: 'USDA ERS — Food Dollar Series',
    sourceUrl: 'https://www.ers.usda.gov/data-products/food-dollar',
  },
  {
    category: 'bananas',
    headline: 'Why bananas almost never change price',
    body: 'Bananas are grown year-round in tropical climates and shipped continuously at enormous scale, so there is no harvest season to create shortages. They are also used as a loss leader — priced low to draw shoppers in. That makes them a useful benchmark: if bananas are noticeably pricier at one store, it usually says something about that store rather than about bananas.',
    sourceLabel: 'USDA ERS — Fruit & Tree Nuts',
    sourceUrl: 'https://www.ers.usda.gov/topics/crops/fruit-and-tree-nuts',
  },
];
