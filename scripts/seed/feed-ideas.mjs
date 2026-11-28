// Starter ideas for the swipe feed: 50 product ideas x 4 decks (headline, description, price, launch reward) = 200 decks,
// split across 5 founder accounts (10 products, 40 decks each).
//
// Why: the feed is empty until founders publish, and the 30-card practice round is set aside for now
// (src/features/quality/server/switch.ts). These give new swipers real decks to answer from day one.
//
// Honest by construction:
// - Each product belongs to one of 5 founder accounts (database records only, not Firebase users, with .invalid emails)
//   and shows that name on the card. Ideas are dealt to founders in turn, so any first-N slice mixes owners.
// - The launch reward only promises what PitchSwipe can keep: first access if the idea gets built.
// - No numbers about results, swipers or waitlists: those come only from real answers and Flagsmith.
// Pure data, no connection, safe to import in tests. scripts/seed/feed-decks.mjs writes it; feed-decks.test.mjs checks it.
import { STARTER_OWNER_UID } from "../../src/features/swipe/starter.ts";

/** Five founder accounts. firebaseUid is a stable key (same style as the old house account); emails are reserved .invalid. */
export const FOUNDERS = [
  { firebaseUid: "founder-pitchswipe-aarav-mehta", name: "Aarav Mehta", email: "aarav.mehta@pitchswipe.invalid" },
  { firebaseUid: "founder-pitchswipe-diya-nair", name: "Diya Nair", email: "diya.nair@pitchswipe.invalid" },
  { firebaseUid: "founder-pitchswipe-rohan-iyer", name: "Rohan Iyer", email: "rohan.iyer@pitchswipe.invalid" },
  { firebaseUid: "founder-pitchswipe-ananya-banerjee", name: "Ananya Banerjee", email: "ananya.banerjee@pitchswipe.invalid" },
  { firebaseUid: "founder-pitchswipe-karthik-reddy", name: "Karthik Reddy", email: "karthik.reddy@pitchswipe.invalid" },
];

export const QUESTION = {
  question: "Would you pay for this?",
  positiveLabel: "Yes, I would pay",
  negativeLabel: "No, I would not",
};

/** Same three rewards for every reward deck: all of them are promises PitchSwipe can keep. */
export const REWARDS = [
  "Get first access if this gets built",
  "Get 3 months free if this gets built",
  "Get a say in what gets built first",
];

/**
 * One entry per product. headlines[0], descriptions[0], prices[1] and rewards[0] are the locked values on decks that
 * test something else. prices are the "find the best price" levels (same unit).
 */
const BASE_IDEAS = [
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
  {
    name: "Lab Report Simple",
    icon: "L",
    category: "Blood test reports explained in plain words",
    industry: "Healthcare",
    targetUsers: ["Salaried", "Homemaker"],
    headlines: ["Understand your blood test in plain words.", "Know what each number means.", "Keep every report in one place."],
    descriptions: [
      "Upload a lab report and Lab Report Simple shows which numbers are in range and what to ask your doctor.",
      "See your sugar, thyroid and cholesterol numbers over the years, so a slow change is easy to spot.",
      "Share a family member's reports with their doctor in one tap, with no photos lost in chats.",
    ],
    prices: ["Rs 49 / report", "Rs 99 / report", "Rs 149 / report"],
  },
  {
    name: "Clinic Queue",
    icon: "C",
    category: "Token queue for small clinics",
    industry: "Healthcare",
    targetUsers: ["Doctor", "Shop owner"],
    headlines: ["No more crowded waiting rooms.", "Patients know when their turn is near.", "Fewer walk-outs, calmer clinic."],
    descriptions: [
      "Patients take a token on WhatsApp and get a message when three people are ahead of them.",
      "Clinic Queue shows the doctor today's list and how long each visit usually takes.",
      "Book follow-up visits from the queue, so regular patients never wait for a slot.",
    ],
    prices: ["Rs 299 / mo", "Rs 499 / mo", "Rs 799 / mo"],
  },
  {
    name: "Sugar Diary",
    icon: "S",
    category: "Daily sugar log with family alerts",
    industry: "Healthcare",
    targetUsers: ["Salaried", "Homemaker"],
    headlines: ["Log your sugar in ten seconds.", "Your family sees when it runs high.", "A diary your doctor will read."],
    descriptions: [
      "Say your sugar reading aloud and Sugar Diary saves it with the time and what you ate.",
      "A message goes to a family member when a reading is too high or too low.",
      "Get a one-page summary of the month to show your doctor at the next visit.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 149 / mo"],
  },
  {
    name: "Train Seat Alert",
    icon: "T",
    category: "Alerts for waitlisted train tickets",
    industry: "Travel",
    targetUsers: ["Student", "Salaried"],
    headlines: ["Know the moment your ticket confirms.", "Find a seat on another date or train.", "Stop checking the waitlist all day."],
    descriptions: [
      "Add your waitlisted ticket and get a message when it moves, with the chance of confirming.",
      "If your ticket is unlikely to confirm, see nearby trains and dates that still have seats.",
      "Watch a sold-out train and get a message when a seat opens after a cancellation.",
    ],
    prices: ["Rs 19 / ticket", "Rs 39 / ticket", "Rs 59 / ticket"],
  },
  {
    name: "Homestay Hub",
    icon: "H",
    category: "Bookings for village homestays",
    industry: "Travel",
    targetUsers: ["Business owner", "Homemaker"],
    headlines: ["Fill your spare rooms.", "Guests book straight with you.", "Turn your home into a homestay."],
    descriptions: [
      "List your rooms with photos and prices. Guests book and pay a deposit by UPI, with no agent cut.",
      "Homestay Hub keeps one calendar for every room, so you never take two bookings for one night.",
      "Send guests the route, the check-in time and a meal menu on WhatsApp before they arrive.",
    ],
    prices: ["Rs 199 / mo", "Rs 399 / mo", "Rs 599 / mo"],
  },
  {
    name: "Board Exam Planner",
    icon: "B",
    category: "Daily study plan for board exams",
    industry: "Education",
    targetUsers: ["Student"],
    headlines: ["A study plan that fits your last 90 days.", "Know what to study today.", "Revise every chapter before the exam."],
    descriptions: [
      "Enter your exam date and weak subjects. Board Exam Planner gives you a short plan for every day.",
      "Mark what you finished and the plan moves the rest, so a missed day does not break it.",
      "Parents see a simple weekly progress note, without asking the child every evening.",
    ],
    prices: ["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo"],
  },
  {
    name: "Spoken English Buddy",
    icon: "S",
    category: "Daily English speaking practice by call",
    industry: "Education",
    targetUsers: ["Student", "Salaried"],
    headlines: ["Practise English aloud, every day.", "A friendly voice that never judges.", "Speak up in your next interview."],
    descriptions: [
      "Get a ten-minute call every day to practise speaking. Spoken English Buddy corrects you gently after each call.",
      "Practise real situations, like a job interview or asking a bank for help, in simple English.",
      "See the words you got wrong this week and practise only those.",
    ],
    prices: ["Rs 199 / mo", "Rs 349 / mo", "Rs 499 / mo"],
  },
  {
    name: "Saree Swap",
    icon: "S",
    category: "Rent festive sarees and lehengas",
    industry: "Fashion",
    targetUsers: ["Homemaker", "Salaried"],
    headlines: ["Wear it once. Do not buy it.", "A new festive look every season.", "Wedding outfits at a fraction of the price."],
    descriptions: [
      "Rent a saree or lehenga for three days. It arrives cleaned, with a blouse fitted to your size.",
      "List the outfits you wore once and earn each time someone rents them.",
      "Try a look at home first and keep it for the event only if you like it.",
    ],
    prices: ["Rs 499 / rental", "Rs 799 / rental", "Rs 1,199 / rental"],
  },
  {
    name: "Cobbler Connect",
    icon: "C",
    category: "Shoe and bag repair picked up from home",
    industry: "Fashion",
    targetUsers: ["Salaried", "Homemaker"],
    headlines: ["Fix it, do not throw it.", "Shoe repair picked up from your door.", "Your old bag, good as new."],
    descriptions: [
      "Book a pickup for shoes, bags and belts. A local cobbler repairs them and returns them in three days.",
      "See the repair price before you book, with photos of the finished work.",
      "Cobblers get a steady stream of repair jobs from their neighbourhood, paid by UPI.",
    ],
    prices: ["Rs 99 / pickup", "Rs 149 / pickup", "Rs 199 / pickup"],
  },
  {
    name: "Flat Fix",
    icon: "F",
    category: "Trusted plumbers and electricians for flats",
    industry: "Real estate",
    targetUsers: ["Salaried", "Homemaker"],
    headlines: ["A plumber who actually turns up.", "Fixed prices before the visit.", "Repairs for your flat, sorted."],
    descriptions: [
      "Book a plumber, electrician or carpenter in your society. The visit price is shown before they come.",
      "Every worker is known to your society, so you do not let strangers into your home.",
      "See the repair history of your flat, so you know what was fixed and when.",
    ],
    prices: ["Rs 49 / booking", "Rs 99 / booking", "Rs 149 / booking"],
  },
  {
    name: "Seed Match",
    icon: "S",
    category: "Local seed and fertiliser dealers, compared",
    industry: "Agriculture",
    targetUsers: ["Farmer", "Wholesaler"],
    headlines: ["Compare seed prices before you buy.", "Buy from a dealer near your farm.", "Know what your neighbours sowed."],
    descriptions: [
      "See the price of seeds and fertiliser at dealers near you, and order for pickup or delivery.",
      "Read what farmers in your area used last season and how it did, in their own words.",
      "Dealers list stock and prices once and farmers see them the same day.",
    ],
    prices: ["Rs 20 / mo", "Rs 40 / mo", "Rs 60 / mo"],
  },
  {
    name: "Bill Book Plus",
    icon: "B",
    category: "Credit book for small shops",
    industry: "Retail",
    targetUsers: ["Shop owner"],
    headlines: ["Stop losing money to the credit notebook.", "Remind regulars to pay, politely.", "Know who owes you, at a glance."],
    descriptions: [
      "Note each credit sale in seconds. Bill Book Plus sends a gentle payment reminder with a UPI link.",
      "See your total outstanding and the five customers who owe the most.",
      "Share a customer's statement on WhatsApp, so there is no argument about the amount.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 149 / mo"],
  },
  {
    name: "Chit Fund Tracker",
    icon: "C",
    category: "Monthly chit and committee tracking",
    industry: "Finance",
    targetUsers: ["Homemaker", "Business owner"],
    headlines: ["Run your chit without a ledger.", "Everyone sees who has paid.", "Know whose turn it is, every month."],
    descriptions: [
      "Add the members and the monthly amount. Chit Fund Tracker records each payment and whose turn it is.",
      "A reminder goes to every member before the due date, with a UPI link to pay.",
      "Everyone sees the same record, so nobody argues about what was paid.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 199 / mo"],
  },
  {
    name: "Dabba Share",
    icon: "D",
    category: "Cloud kitchen for office lunch groups",
    industry: "Food",
    targetUsers: ["Salaried"],
    headlines: ["Lunch for your whole floor.", "One order, one delivery, less to pay.", "Fresh lunch at your desk by 1 pm."],
    descriptions: [
      "Teams pick a lunch from a neighbourhood kitchen by 10 am. One delivery for the group keeps the price low.",
      "Everyone chooses their own dish and pays their own share by UPI.",
      "Set a weekly menu for your team and repeat it every Monday with one tap.",
    ],
    prices: ["Rs 99 / meal", "Rs 129 / meal", "Rs 159 / meal"],
  },
  {
    name: "Tempo Share",
    icon: "T",
    category: "Shared tempo loads for small traders",
    industry: "Logistics",
    targetUsers: ["Shop owner", "Wholesaler", "Driver"],
    headlines: ["Share a tempo. Split the freight.", "Do not pay for an empty half load.", "Send small loads at small prices."],
    descriptions: [
      "Add your small load and Tempo Share finds other traders sending goods the same way the same day.",
      "Drivers fill their empty space on the return trip and earn more from the same journey.",
      "Track your goods on the way and get a message when they are delivered.",
    ],
    prices: ["Rs 29 / load", "Rs 49 / load", "Rs 79 / load"],
  },
  {
    name: "Ludo Leagues",
    icon: "L",
    category: "Friends tournaments for board games",
    industry: "Gaming",
    targetUsers: ["Student"],
    headlines: ["Run a Ludo league with your friends.", "Weekly tables, real bragging rights.", "Play, score, repeat."],
    descriptions: [
      "Make a league with your friends. Ludo Leagues keeps the table and the scores for every week.",
      "Play a quick match any time and see your rank move on the group board.",
      "Hold a small hostel tournament with brackets made for you.",
    ],
    prices: ["Rs 19 / mo", "Rs 39 / mo", "Rs 59 / mo"],
  },
  {
    name: "Cricket Club Hub",
    icon: "C",
    category: "Team and match manager for local cricket clubs",
    industry: "Gaming",
    targetUsers: ["Student", "Salaried"],
    headlines: ["Your gully team, run properly.", "Pick the eleven in two minutes.", "Every match score, saved for good."],
    descriptions: [
      "Ask who is playing on Sunday and get a reply from every player. The team list builds itself.",
      "Score the match ball by ball and keep every player's runs and wickets for the season.",
      "Collect the ground fee from each player by UPI, so nobody pays for everyone.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 149 / mo"],
  },
  {
    name: "Society Desk",
    icon: "S",
    category: "Dues and notices for housing societies",
    industry: "SaaS",
    targetUsers: ["Business owner", "Salaried"],
    headlines: ["Run your society without a register.", "Maintenance paid on time, by UPI.", "Every notice reaches every flat."],
    descriptions: [
      "Send maintenance bills to every flat with a UPI link, and see who has paid on one screen.",
      "Post a notice once and it goes to every resident on WhatsApp.",
      "Residents raise complaints from their phone, and the committee sees what is still open.",
    ],
    prices: ["Rs 499 / mo", "Rs 799 / mo", "Rs 1,199 / mo"],
  },
  {
    name: "Call Notes Hindi",
    icon: "C",
    category: "Call and visit notes for field sales teams",
    industry: "SaaS",
    targetUsers: ["Business owner", "Freelancer"],
    headlines: ["Speak your visit notes. We write them.", "Follow-ups that never get forgotten.", "Your sales team, in one list."],
    descriptions: [
      "After each visit, say what happened in Hindi or English. Call Notes Hindi writes it down and sets the follow-up.",
      "Owners see which customers were visited this week and which were missed.",
      "A reminder arrives the morning a follow-up is due, with the last note beside it.",
    ],
    prices: ["Rs 149 / user / mo", "Rs 249 / user / mo", "Rs 349 / user / mo"],
  },
  {
    name: "Run Club Near Me",
    icon: "R",
    category: "Find group runs and walks nearby",
    industry: "Fitness",
    targetUsers: ["Salaried", "Student"],
    headlines: ["Find people to run with, near you.", "Morning walks with a group.", "Turn up, run, repeat."],
    descriptions: [
      "See running and walking groups in your area with the time, the place and the pace.",
      "Join a free run and see who else is coming. Start your own with a few taps.",
      "Track your weekly distance and keep a streak with your group.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 149 / mo"],
  },
  {
    name: "Mehendi Book",
    icon: "M",
    category: "Bookings for mehendi and makeup artists",
    industry: "Beauty",
    targetUsers: ["Freelancer", "Homemaker"],
    headlines: ["Wedding-season bookings, handled.", "Show your designs, get booked.", "No more missed enquiries."],
    descriptions: [
      "Share one link with your design photos and open dates. Clients pick a date and pay an advance by UPI.",
      "See every event for the month on one calendar, with the address and the time.",
      "Send a reminder and a thank-you message to each client for you.",
    ],
    prices: ["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo"],
  },
  {
    name: "Pet Sitter Near",
    icon: "P",
    category: "Pet sitters and walkers in your area",
    industry: "Pets",
    targetUsers: ["Salaried", "Homemaker"],
    headlines: ["Someone you trust for your pet.", "Go on holiday without worry.", "A daily walk when you are at work."],
    descriptions: [
      "Find a pet sitter or walker near you, read reviews from neighbours and book a trial visit.",
      "Get a photo and a short message after every walk, so you know your dog is fine.",
      "Love animals? List yourself as a sitter and earn from pets in your building.",
    ],
    prices: ["Rs 99 / booking", "Rs 199 / booking", "Rs 299 / booking"],
  },
  {
    name: "Pet Food Plan",
    icon: "P",
    category: "Monthly pet food and supplies delivery",
    industry: "Pets",
    targetUsers: ["Salaried", "Homemaker"],
    headlines: ["Pet food that never runs out.", "Delivered before the bag is empty.", "The right food for your pet's age."],
    descriptions: [
      "Tell us your pet's age and size. Pet Food Plan delivers the right food every month and you can pause any time.",
      "Add treats and supplies to the same delivery, so you make one payment, not three.",
      "Switch brands or sizes whenever you like, with no charge for changing.",
    ],
    prices: ["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo"],
  },
  {
    name: "Story Time Hindi",
    icon: "S",
    category: "Bedtime stories for children, in Indian languages",
    industry: "Kids",
    targetUsers: ["Homemaker", "Salaried"],
    headlines: ["Bedtime stories in your own language.", "A new story every night.", "Screen-free stories, read aloud."],
    descriptions: [
      "Every night, a short story is read aloud in Hindi, Tamil, Bengali or Marathi, with calm music and no pictures.",
      "Pick the age and what your child likes and the story fits tonight's bedtime.",
      "Grandparents can record a story in their own voice and your child hears it each week.",
    ],
    prices: ["Rs 49 / mo", "Rs 99 / mo", "Rs 149 / mo"],
  },
  {
    name: "Hobby Class Kids",
    icon: "H",
    category: "Weekend hobby classes for children",
    industry: "Kids",
    targetUsers: ["Homemaker", "Salaried"],
    headlines: ["Weekend classes your child will enjoy.", "Art, music and chess, near home.", "Try a class before you pay for a month."],
    descriptions: [
      "Find art, music, dance and chess classes near you. Book one trial class before paying for a month.",
      "See the teacher, the batch size and the fee up front, with reviews from other parents.",
      "Teachers fill their weekend batches without paying for ads.",
    ],
    prices: ["Rs 499 / mo", "Rs 799 / mo", "Rs 1,199 / mo"],
  },
];

/**
 * Five extra ideas for `seed:feed -- --owner-email <email>`: they go to one real founder's own account instead of
 * the five feed founders. Different from the 50 feed products. `owner` is filled in by the seed once the user is found.
 */
export const OWNER_IDEAS = [
  {
    name: "Mess Menu Daily",
    icon: "M",
    category: "Daily mess menus for hostels and PGs",
    industry: "Food",
    targetUsers: ["Student", "Salaried"],
    headlines: ["See today's mess menu before you walk in.", "Rate the meal, get it fixed.", "Know when your favourite dish is on."],
    descriptions: [
      "Mess owners post the day's menu in one tap and residents see it on their phone before meal time.",
      "Residents rate each meal in one tap and the mess owner sees which dishes need work.",
      "Plan a week of menus once, repeat them, and tell residents about any change on WhatsApp.",
    ],
    prices: ["Rs 99 / mo", "Rs 199 / mo", "Rs 299 / mo"],
  },
  {
    name: "Appointment Pad",
    icon: "A",
    category: "Bookings for physiotherapists and small clinics",
    industry: "Healthcare",
    targetUsers: ["Doctor", "Freelancer"],
    headlines: ["Fewer missed appointments.", "Patients book their own slots.", "Your day's list, ready each morning."],
    descriptions: [
      "Patients pick a free slot from your link. Appointment Pad reminds them the evening before.",
      "Keep each patient's visit notes and the number of sessions left in one place.",
      "Fill cancelled slots by messaging the patients waiting for an earlier time.",
    ],
    prices: ["Rs 199 / mo", "Rs 349 / mo", "Rs 499 / mo"],
  },
  {
    name: "Fleet Fuel Log",
    icon: "F",
    category: "Fuel and mileage tracking for small fleets",
    industry: "Logistics",
    targetUsers: ["Business owner", "Driver"],
    headlines: ["Know where your diesel goes.", "Mileage per vehicle, worked out for you.", "Catch fuel leaks early."],
    descriptions: [
      "Drivers photograph the fuel slip and the odometer. Fleet Fuel Log works out the mileage of each vehicle.",
      "See which vehicle is using more fuel than usual, before the month's bill arrives.",
      "Owners get one weekly sheet of fuel spend for every vehicle, ready to share with the accountant.",
    ],
    prices: ["Rs 49 / vehicle / mo", "Rs 99 / vehicle / mo", "Rs 149 / vehicle / mo"],
  },
  {
    name: "Handloom Direct",
    icon: "H",
    category: "Buy handloom straight from weavers",
    industry: "Fashion",
    targetUsers: ["Homemaker", "Salaried"],
    headlines: ["Handloom, straight from the weaver.", "Know who made your saree.", "Fair prices for weavers and for you."],
    descriptions: [
      "Browse sarees and fabric from weaver families, each with the weaver's name, village and loom type.",
      "Weavers set their own price and keep the full amount after a small listing fee.",
      "Order a custom length or colour and the weaver confirms the timeline before you pay.",
    ],
    prices: ["Rs 99 / order", "Rs 149 / order", "Rs 199 / order"],
  },
  {
    name: "Study Group Live",
    icon: "S",
    category: "Small online study groups for exam prep",
    industry: "Education",
    targetUsers: ["Student"],
    headlines: ["Study with five others, every evening.", "Stay on track with a group.", "Doubts cleared before the next session."],
    descriptions: [
      "Join a group of six students preparing for the same exam. Meet on video at a fixed time each evening.",
      "Each session has a goal, a timer and a short quiz, so the hour is never wasted.",
      "A tutor joins once a week to clear the doubts the group could not solve.",
    ],
    prices: ["Rs 199 / mo", "Rs 349 / mo", "Rs 499 / mo"],
  },
];

/** Ideas dealt to founders in turn: idea i belongs to FOUNDERS[i % 5], so each founder owns 10. */
export const IDEAS = BASE_IDEAS.map((idea, i) => ({ ...idea, owner: FOUNDERS[i % FOUNDERS.length] }));

/** Headline and price first: they are the two tests the app shows best (the price test draws a demand curve). */
export const FEED_VARIABLES = ["headline", "price", "description", "reward"];

/** Product settings for the idea's founder (validated by src/features/decks/product.ts validateProduct). */
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

/** The deck body for one idea and one variable (validated by src/features/decks/validate.ts in "publish" mode). */
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
 * The decks the feed seed writes: by default all 50 ideas x 4 variables = 200.
 * `ideas` keeps the first N ideas; `variables` keeps only those test types (e.g. ["headline", "price"]).
 */
export function feedPlan({ ideas, variables = FEED_VARIABLES, pool = IDEAS } = {}) {
  if (ideas === undefined) ideas = pool.length;
  const unknown = variables.filter((v) => !FEED_VARIABLES.includes(v));
  if (unknown.length > 0) throw new Error(`Unknown test type: ${unknown.join(", ")}. Use ${FEED_VARIABLES.join(", ")}.`);
  if (!Number.isInteger(ideas) || ideas < 1 || ideas > pool.length) throw new Error(`ideas must be 1 to ${pool.length}.`);
  return pool.slice(0, ideas).flatMap((idea) => variables.map((variable) => ({ idea, variable })));
}
