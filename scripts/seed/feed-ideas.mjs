// Starter ideas for the swipe feed: 25 product ideas x 4 decks (headline, description, price, launch reward) = 100 decks.
//
// Why: the feed is empty until founders publish, and the 30-card practice round is set aside for now
// (src/lib/quality/switch.ts). These give new swipers real decks to answer from day one.
//
// Honest by construction:
// - Every product belongs to one house account and shows its name on the card ("PitchSwipe Ideas Lab"), so no card
//   pretends a real founder is behind it.
// - The launch reward only promises what PitchSwipe can keep: first access if the idea gets built.
// - No numbers about results, swipers or waitlists: those come only from real answers and Flagsmith.
// Pure data, no connection, safe to import in tests. scripts/seed/feed-decks.mjs writes it; feed-decks.test.mjs checks it.
import { STARTER_OWNER_UID } from "../../src/lib/swipe/starter.ts";

export const HOUSE_ACCOUNT = {
  // The feed gives this account's decks less traffic than founders' decks (src/lib/swipe/starter.ts).
  firebaseUid: STARTER_OWNER_UID,
  name: "PitchSwipe Ideas Lab",
  // Reserved .invalid domain: never a real inbox, never emailed.
  email: "ideas-lab@pitchswipe.invalid",
};

export const QUESTION = {
  question: "Would you pay for this?",
  positiveLabel: "Yes, I would pay",
  negativeLabel: "No, I would not",
};

/** Same three rewards for every reward deck: all of them are promises the house account can keep. */
export const REWARDS = [
  "Get first access if this gets built",
  "Get 3 months free if this gets built",
  "Get a say in what gets built first",
];

/**
 * One entry per product. headlines[0], descriptions[0], prices[1] and rewards[0] are the locked values on decks that
 * test something else. prices are the "find the best price" levels (same unit).
 */
export const IDEAS = [
  {
    name: "Kirana Restock",
    icon: "K",
    category: "Stock reorders for small shops",
    industry: "Retail",
    targetUsers: ["Shop owner", "Wholesaler"],
    headlines: ["Reorder stock in one tap.", "Never run out of your best sellers.", "Your wholesaler, one WhatsApp away."],
    descriptions: [
      "Scan what is running low and Kirana Restock sends the order to your wholesaler on WhatsApp. No calls, no lists on paper.",
      "Kirana Restock learns what sells each week and reminds you to reorder before the shelf is empty.",
      "Keep every order to every wholesaler in one place, with the price you paid last time.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 149 / mo"],
  },
  {
    name: "Mandi Rate",
    icon: "M",
    category: "Daily crop prices from nearby mandis",
    industry: "Agriculture",
    targetUsers: ["Farmer", "Wholesaler"],
    headlines: ["Know the best mandi before you load the truck.", "Today's crop prices, every morning.", "Sell where the price is highest."],
    descriptions: [
      "Mandi Rate shows today's prices for your crop at every mandi within 100 km, on your phone, in your language.",
      "Get a morning message with the three best mandis for your crop and how far each one is.",
      "Compare mandi prices over the last month so you know when to sell and when to wait.",
    ],
    prices: ["Rs 20 / mo", "Rs 50 / mo", "Rs 80 / mo"],
  },
  {
    name: "Tiffin Track",
    icon: "T",
    category: "Home tiffin subscriptions",
    industry: "Food",
    targetUsers: ["Salaried", "Student"],
    headlines: ["Home food, every weekday.", "Skip a tiffin with one tap.", "Pay only for the meals you eat."],
    descriptions: [
      "Subscribe to a home cook near you. Lunch arrives every weekday and you skip a day from your phone by 10 am.",
      "Tiffin Track bills you only for the days you ate, so leave and holidays cost nothing.",
      "See tomorrow's menu tonight and swap to another cook in your area any week.",
    ],
    prices: ["Rs 1,800 / mo", "Rs 2,400 / mo", "Rs 3,000 / mo"],
  },
  {
    name: "Medi Remind",
    icon: "M",
    category: "Medicine reminders for parents",
    industry: "Healthcare",
    targetUsers: ["Salaried", "Homemaker"],
    headlines: ["Know your parents took their medicine.", "A gentle call when a dose is missed.", "Refill before the strip runs out."],
    descriptions: [
      "Medi Remind calls your parents when a dose is due and tells you if they did not answer.",
      "Photograph the prescription once. Reminders, refills and doctor visits are set up for you.",
      "A shared list of every medicine in the family, with a reminder before each strip runs out.",
    ],
    prices: ["Rs 99 / mo", "Rs 149 / mo", "Rs 249 / mo"],
  },
  {
    name: "Route Saathi",
    icon: "R",
    category: "Trip expenses for truck drivers",
    industry: "Logistics",
    targetUsers: ["Driver", "Business owner"],
    headlines: ["Every rupee of the trip, in one place.", "Fuel, tolls and food, logged by voice.", "Settle trip money in minutes."],
    descriptions: [
      "Say what you spent and Route Saathi logs it against the trip. The owner sees the total when you arrive.",
      "Photograph toll and fuel slips on the road. The trip sheet is ready when the trip ends.",
      "Drivers and owners see the same trip sheet, so settling advances takes minutes, not arguments.",
    ],
    prices: ["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo"],
  },
  {
    name: "Tuition Book",
    icon: "T",
    category: "Fees and batches for home tutors",
    industry: "Education",
    targetUsers: ["Freelancer", "Homemaker"],
    headlines: ["Stop chasing tuition fees.", "Every batch, every fee, one app.", "Parents pay on time, by UPI."],
    descriptions: [
      "Tuition Book sends parents a polite fee reminder with a UPI link on the first of every month.",
      "Keep attendance, fees and test marks for every batch in one place and share them with parents.",
      "See who has paid this month at a glance, and send one reminder to everyone who has not.",
    ],
    prices: ["Rs 99 / mo", "Rs 149 / mo", "Rs 199 / mo"],
  },
  {
    name: "Rent Remind",
    icon: "R",
    category: "Rent collection for small landlords",
    industry: "Real estate",
    targetUsers: ["Business owner", "Salaried"],
    headlines: ["Rent on time, without the awkward call.", "Every tenant, every month, tracked.", "Rent receipts sent for you."],
    descriptions: [
      "Rent Remind messages each tenant before rent is due with a UPI link, and tells you who has paid.",
      "A receipt goes to the tenant the moment rent arrives, ready for their tax filing.",
      "Track rent, deposits and repairs for every flat in one list.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 199 / mo"],
  },
  {
    name: "Stitch Slot",
    icon: "S",
    category: "Order book for tailors",
    industry: "Fashion",
    targetUsers: ["Shop owner", "Freelancer"],
    headlines: ["Every order and measurement, saved.", "Tell customers when it is ready, in one tap.", "No more lost measurement slips."],
    descriptions: [
      "Save each customer's measurements once. Stitch Slot keeps every order with its delivery date.",
      "Send a ready-for-pickup message with the balance due, straight from the order.",
      "See this week's deliveries at a glance so nothing is late during the wedding season.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 149 / mo"],
  },
  {
    name: "Gym Pass Local",
    icon: "G",
    category: "One pass for neighbourhood gyms",
    industry: "Fitness",
    targetUsers: ["Salaried", "Student"],
    headlines: ["One pass, every gym near you.", "Work out near office or near home.", "Pay for the days you go."],
    descriptions: [
      "Gym Pass Local lets you check in at any partner gym near home or office with one monthly pass.",
      "Book a slot, walk in, scan the code. Switch gyms any day you like.",
      "A pass that pauses when you travel, so you never pay for days you could not go.",
    ],
    prices: ["Rs 799 / mo", "Rs 1,199 / mo", "Rs 1,599 / mo"],
  },
  {
    name: "Salon Slots",
    icon: "S",
    category: "WhatsApp bookings for salons",
    industry: "Beauty",
    targetUsers: ["Shop owner", "Freelancer"],
    headlines: ["Customers book on WhatsApp. You just cut.", "No more double bookings.", "Fill the empty chairs on weekdays."],
    descriptions: [
      "Customers pick a slot on WhatsApp and Salon Slots fills your day. You see the list each morning.",
      "Each stylist has their own calendar, so two customers never get the same slot.",
      "Send a weekday offer to past customers when the chairs are empty.",
    ],
    prices: ["Rs 199 / mo", "Rs 299 / mo", "Rs 499 / mo"],
  },
  {
    name: "Pet Vet Home",
    icon: "P",
    category: "Vet visits at home",
    industry: "Pets",
    targetUsers: ["Salaried", "Homemaker"],
    headlines: ["The vet comes to you.", "Vaccines at home, on time.", "No more scared pets in autos."],
    descriptions: [
      "Book a vet to your home for check-ups and vaccines. Pet Vet Home reminds you when the next one is due.",
      "Every visit, vaccine and prescription for your pet in one record you can show any vet.",
      "A vet on video in 15 minutes, and at your door the same day if needed.",
    ],
    prices: ["Rs 299 / visit", "Rs 499 / visit", "Rs 699 / visit"],
  },
  {
    name: "Kids Bus Live",
    icon: "K",
    category: "Live tracking for school vans",
    industry: "Kids",
    targetUsers: ["Homemaker", "Salaried", "Driver"],
    headlines: ["Know where the school van is.", "A message when your child is dropped.", "No more waiting at the gate."],
    descriptions: [
      "See the school van on a map and get a message five minutes before it reaches your stop.",
      "The driver taps once at each drop, and every parent gets a message that their child is home.",
      "Van drivers get one list of stops and parents, so a change is one message, not twenty calls.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 149 / mo"],
  },
  {
    name: "GST Easy",
    icon: "G",
    category: "GST invoices and reminders for small shops",
    industry: "Finance",
    targetUsers: ["Shop owner", "Business owner"],
    headlines: ["GST bills from your phone.", "Never miss a GST date again.", "Your accountant gets everything, on time."],
    descriptions: [
      "Make a GST bill in 30 seconds and share it on WhatsApp. GST Easy keeps a copy for filing.",
      "A reminder a week before every GST date, with this month's sales already added up.",
      "Send the month's bills to your accountant in one tap, in the format they need.",
    ],
    prices: ["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo"],
  },
  {
    name: "Trip Split",
    icon: "T",
    category: "Shared trip expenses with UPI settle-up",
    industry: "Travel",
    targetUsers: ["Student", "Salaried"],
    headlines: ["Split the trip. Settle by UPI.", "Who owes whom, worked out for you.", "Plan the trip money before you leave."],
    descriptions: [
      "Add what each person paid. Trip Split works out the fewest UPI payments to settle everyone.",
      "Set a budget for the trip and see how much is left as the group spends.",
      "Everyone adds their own costs from their phone, so nobody keeps a list.",
    ],
    prices: ["Rs 29 / trip", "Rs 49 / trip", "Rs 99 / trip"],
  },
  {
    name: "Farm Rent",
    icon: "F",
    category: "Tractors and tools by the hour",
    industry: "Agriculture",
    targetUsers: ["Farmer"],
    headlines: ["Rent a tractor by the hour.", "The right tool, the day you need it.", "Earn from your tractor when it is free."],
    descriptions: [
      "Book a tractor, rotavator or sprayer from a farmer nearby, by the hour, with the price agreed upfront.",
      "Own a tractor? List it when it is free and earn from neighbours who need it.",
      "See which machines are free in your village this week and book before sowing starts.",
    ],
    prices: ["Rs 20 / booking", "Rs 50 / booking", "Rs 80 / booking"],
  },
  {
    name: "Chai Counter",
    icon: "C",
    category: "Simple sales counter for tea stalls",
    industry: "Food",
    targetUsers: ["Shop owner"],
    headlines: ["Know today's sales without a notebook.", "UPI and cash, added up for you.", "See what sells by the hour."],
    descriptions: [
      "Tap each sale and Chai Counter adds cash and UPI separately, so the day's total is ready at closing.",
      "See your busiest hours and best sellers each week, to plan milk and snacks.",
      "Keep a running tab for regular customers and send them a total at month end.",
    ],
    prices: ["Rs 29 / mo", "Rs 49 / mo", "Rs 99 / mo"],
  },
  {
    name: "Dukaan Page",
    icon: "D",
    category: "A shop website from your WhatsApp catalogue",
    industry: "SaaS",
    targetUsers: ["Shop owner", "Business owner"],
    headlines: ["Your shop online in 5 minutes.", "Turn your WhatsApp catalogue into a website.", "Customers find you on Google."],
    descriptions: [
      "Dukaan Page turns your WhatsApp catalogue into a one-page shop website with your address and timings.",
      "Customers tap a product on your page and the order arrives on your WhatsApp.",
      "Your page shows up when people nearby search for what you sell.",
    ],
    prices: ["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo"],
  },
  {
    name: "Shift Check",
    icon: "S",
    category: "Staff attendance by selfie",
    industry: "SaaS",
    targetUsers: ["Business owner", "Shop owner"],
    headlines: ["Staff attendance without a register.", "Salary worked out from attendance.", "Know who is late, without asking."],
    descriptions: [
      "Staff check in with a selfie at the shop. Shift Check keeps the times and works out the month's salary.",
      "See who came, who is late and who is on leave, from your phone, wherever you are.",
      "Advances and leave are logged with attendance, so salary day has no surprises.",
    ],
    prices: ["Rs 20 / staff / mo", "Rs 40 / staff / mo", "Rs 60 / staff / mo"],
  },
  {
    name: "Quiz Katta",
    icon: "Q",
    category: "Daily quiz streaks with friends",
    industry: "Gaming",
    targetUsers: ["Student"],
    headlines: ["Five questions a day. Beat your friends.", "Keep your streak alive.", "Learn something new every morning."],
    descriptions: [
      "Quiz Katta sends five questions every morning. Answer them to keep your streak and climb your friends' board.",
      "Make a group with your class and see who knows the most this week.",
      "Pick topics you like, from cricket to current affairs, and learn a little every day.",
    ],
    prices: ["Rs 29 / mo", "Rs 49 / mo", "Rs 79 / mo"],
  },
  {
    name: "Scrap Pickup",
    icon: "S",
    category: "Scheduled scrap pickup, paid by weight",
    industry: "Logistics",
    targetUsers: ["Homemaker", "Shop owner"],
    headlines: ["Sell your scrap without the haggling.", "A fair price, weighed at your door.", "Book a pickup, get paid by UPI."],
    descriptions: [
      "Book a pickup for paper, plastic and metal. It is weighed on a digital scale and paid by UPI at your door.",
      "See today's rate for each kind of scrap before you book, so you know the price upfront.",
      "Shops can set a weekly pickup so cartons never pile up.",
    ],
    prices: ["Rs 10 / pickup", "Rs 20 / pickup", "Rs 30 / pickup"],
  },
  {
    name: "Home Chef Orders",
    icon: "H",
    category: "Orders and payments for home cooks",
    industry: "Food",
    targetUsers: ["Homemaker", "Freelancer"],
    headlines: ["Take food orders without the chaos.", "Know tomorrow's orders tonight.", "Get paid before you cook."],
    descriptions: [
      "Customers order from your menu link. Home Chef Orders lists tomorrow's orders and collects UPI upfront.",
      "Set how many plates you can make each day and the menu closes when you are full.",
      "Send this week's menu to your regulars in one tap.",
    ],
    prices: ["Rs 99 / mo", "Rs 149 / mo", "Rs 199 / mo"],
  },
  {
    name: "Crop Doctor",
    icon: "C",
    category: "Photo check for crop disease",
    industry: "Agriculture",
    targetUsers: ["Farmer"],
    headlines: ["Photo the leaf. Know the problem.", "Catch crop disease early.", "The right spray, the first time."],
    descriptions: [
      "Take a photo of a sick leaf and Crop Doctor names the likely problem and what local experts suggest.",
      "Get a warning when a disease is spreading in nearby villages, before it reaches your field.",
      "Talk to an agriculture expert on call when the photo check is not sure.",
    ],
    prices: ["Rs 30 / mo", "Rs 60 / mo", "Rs 90 / mo"],
  },
  {
    name: "Invoice Nudge",
    icon: "I",
    category: "Invoices and payment follow-ups for freelancers",
    industry: "Finance",
    targetUsers: ["Freelancer"],
    headlines: ["Get paid without chasing.", "Invoices that follow up for you.", "Know which client owes what."],
    descriptions: [
      "Send an invoice with a UPI link. Invoice Nudge sends polite reminders until it is paid.",
      "See every unpaid invoice and how late it is, across all your clients.",
      "Your invoices carry GST and TDS correctly, so tax time is simple.",
    ],
    prices: ["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo"],
  },
  {
    name: "PG Verified",
    icon: "P",
    category: "Verified PGs and hostels",
    industry: "Real estate",
    targetUsers: ["Student", "Salaried"],
    headlines: ["PGs that look like their photos.", "Visited and checked before you pay.", "Find a PG near your college or office."],
    descriptions: [
      "Every PG on PG Verified is visited and photographed by our team, so what you see is what you get.",
      "Read reviews from people who live there now, and see the real food menu.",
      "Book a visit, pay the deposit online, and get a written agreement.",
    ],
    prices: ["Rs 199 / booking", "Rs 499 / booking", "Rs 799 / booking"],
  },
  {
    name: "Yoga Circle",
    icon: "Y",
    category: "Small-group live yoga at home",
    industry: "Fitness",
    targetUsers: ["Homemaker", "Salaried"],
    headlines: ["Live yoga in a group of eight.", "A teacher who knows your name.", "Morning yoga before the house wakes up."],
    descriptions: [
      "Join a live yoga class of eight people at a fixed time. The teacher corrects your posture by name.",
      "Pick a batch at 6 am, 7 am or 8 pm and keep the same group every week.",
      "Classes for back pain, beginners and seniors, each with a certified teacher.",
    ],
    prices: ["Rs 499 / mo", "Rs 799 / mo", "Rs 999 / mo"],
  },
];

/** Headline and price first: they are the two tests the app shows best (the price test draws a demand curve). */
export const FEED_VARIABLES = ["headline", "price", "description", "reward"];

/** Product settings for the house account (validated by src/lib/decks/product.ts validateProduct). */
export function productInput(idea) {
  return {
    name: idea.name,
    icon: idea.icon,
    category: idea.category,
    industry: idea.industry,
    showOwnerName: true,
    targetUsers: idea.targetUsers,
    audience: { who: "everyone", states: [], interests: [] },
  };
}

const VARIANT_KEYS = ["A", "B", "C", "D"];

/** The deck body for one idea and one variable (validated by src/lib/decks/validate.ts in "publish" mode). */
export function deckInput(idea, variable, productId) {
  const locked = {
    headline: idea.headlines[0],
    description: idea.descriptions[0],
    price: idea.prices[1],
    reward: REWARDS[0],
  };
  const versions = {
    headline: idea.headlines,
    description: idea.descriptions,
    price: idea.prices,
    reward: REWARDS,
  }[variable];
  const shared = { ...locked };
  delete shared[variable];
  return {
    productId,
    variable,
    ...(variable === "price" ? { priceMode: "level" } : {}),
    cards: versions.map((value, i) => ({ variantKey: VARIANT_KEYS[i], value })),
    shared,
    ...QUESTION,
  };
}

/**
 * The decks the feed seed writes: by default all 25 ideas x 4 variables = 100.
 * `ideas` keeps the first N ideas; `variables` keeps only those test types (e.g. ["headline", "price"]).
 */
export function feedPlan({ ideas = IDEAS.length, variables = FEED_VARIABLES } = {}) {
  const unknown = variables.filter((v) => !FEED_VARIABLES.includes(v));
  if (unknown.length > 0) throw new Error(`Unknown test type: ${unknown.join(", ")}. Use ${FEED_VARIABLES.join(", ")}.`);
  if (!Number.isInteger(ideas) || ideas < 1 || ideas > IDEAS.length) throw new Error(`ideas must be 1 to ${IDEAS.length}.`);
  return IDEAS.slice(0, ideas).flatMap((idea) => variables.map((variable) => ({ idea, variable })));
}
