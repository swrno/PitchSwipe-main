import type { Answer } from "./rules";

/** A practice card as shown to the swiper. Never includes `expected`. */
export interface PracticeCard {
  id: string;
  brand: string;
  category: string;
  headline: string;
  detail: string;
  question: string;
  yesLabel: string;
  noLabel: string;
}

/** Server-side card: check cards carry the answer they instruct. */
export interface LibraryCard extends PracticeCard {
  expected?: Answer;
}

const card = (
  id: string,
  brand: string,
  category: string,
  headline: string,
  detail: string,
  question: string,
  yesLabel = "Yes, I would",
  noLabel = "No, I would not",
): LibraryCard => ({ id, brand, category, headline, detail, question, yesLabel, noLabel });

/** Shown on every practice card: these are samples, not a real founder's pitch. */
export const PRACTICE_CARD_LABEL = "Practice card: sample, not a real pitch";

/**
 * Sample library (every card is labelled "Practice card" wherever it is shown). The spec describes 1,000 past tests with known results; this is a small stand-in
 * (30 normal + 6 check cards) so the flow works. Their prices and facts are invented stand-ins: they are only ever shown inside the
 * practice flow, and only the answer and reading time (never a number from a card) are scored and stored.
 * Replace with the real library without touching the rules.
 */
export const NORMAL_CARDS: readonly LibraryCard[] = [
  card("p-tiffinbox", "TiffinBox", "Food", "Home-cooked lunch at your desk by 1 pm.", "Pick from 3 local cooks each morning. Rs 89 a meal.", "Would you order this at work?"),
  card("p-chaiwala", "ChaiRun", "Food", "Fresh chai for the whole office, one tap.", "Flask delivery to your desk at 4 pm. Rs 15 a cup.", "Would you use this every week?"),
  card("p-kiranaquick", "KiranaQuick", "Retail", "Your corner shop, restocked by tomorrow.", "Order from 40 wholesalers in one app. No minimum.", "Would you order stock this way?"),
  card("p-billbook", "BillBook", "Finance", "GST bills in 10 seconds, from your phone.", "Free for 50 bills a month, Rs 199 after that.", "Would you pay Rs 199 a month?"),
  card("p-clinicq", "ClinicQ", "Healthcare", "Skip the waiting room. Book your slot.", "See live queue times for 200 local clinics.", "Would you book your doctor this way?"),
  card("p-truckpool", "TruckPool", "Logistics", "Share a truck, split the freight bill.", "Small loads matched with trucks on the same route.", "Would you ship goods like this?"),
  card("p-tripmate", "TripMate", "Travel", "One bus, train and hotel plan in one chat.", "Rs 99 per trip planned, no booking fees.", "Would you plan your next trip here?"),
  card("p-padhai", "PadhaiNow", "Education", "Class 10 maths tutor, 20 minutes a day.", "Live doubt solving in Hindi and English. Rs 299 a month.", "Would you buy this for your child?"),
  card("p-threadly", "Threadly", "Fashion", "Tailor-made kurtas, delivered in 5 days.", "Share your size once. From Rs 799.", "Would you order a kurta online?"),
  card("p-flatmate", "FlatMate", "Real estate", "Verified flatmates, no broker fee.", "Match by budget, city and sleeping hours.", "Would you find a flat this way?"),
  card("p-kisanmandi", "KisanMandi", "Agriculture", "See today's mandi price before you travel.", "Rates for 60 crops, in your language, free.", "Would you check this every morning?"),
  card("p-formflow", "FormFlow", "SaaS", "Collect orders on WhatsApp, track them in one sheet.", "Rs 499 a month for unlimited orders.", "Would your business pay Rs 499 a month?"),
  card("p-pixelrun", "PixelRun", "Gaming", "Ten-minute quiz battles with friends.", "Win coins, no real money involved. Free to play.", "Would you play this daily?"),
  card("p-fitkhata", "FitKhata", "Fitness", "Gym attendance and fees, sorted.", "Reminders for members who forgot to pay. Rs 399 a month.", "Would you run your gym with it?"),
  card("p-glowbox", "GlowBox", "Beauty", "Salon visit at home, at salon prices.", "Verified beauticians, 90 minutes. From Rs 499.", "Would you book this?"),
  card("p-pawpal", "PawPal", "Pets", "A vet on video call in 15 minutes.", "Rs 249 a consult, prescriptions included.", "Would you call a vet this way?"),
  card("p-storytime", "StoryTime", "Kids", "Bedtime stories in your own voice.", "Record once, play every night. Rs 99 a month.", "Would you try this with your kids?"),
  card("p-saralpay", "SaralPay", "Finance", "Pay your staff on the 1st, without a bank trip.", "Salary in 3 taps. Rs 20 per payment.", "Would you pay your staff this way?"),
  card("p-fixit", "FixIt", "Retail", "A plumber or electrician within 60 minutes.", "Fixed prices shown before you book.", "Would you book home repairs here?"),
  card("p-lunchpass", "LunchPass", "Food", "One monthly pass, 20 lunches at nearby cafes.", "Rs 1,800 a month, any cafe on the list.", "Would you buy the pass?"),
  card("p-medmind", "MedMind", "Healthcare", "Never miss a tablet. Family reminders by call.", "Rs 49 a month per person.", "Would you set this up for a parent?"),
  card("p-roadready", "RoadReady", "Logistics", "Find a return load before you leave the city.", "Free for the first 5 loads, Rs 300 a month after.", "Would you use this on every trip?"),
  card("p-hosteller", "Hosteller", "Travel", "Backpacker stays under Rs 600, rated by locals.", "Book without a card. Pay at the desk.", "Would you book your stay here?"),
  card("p-skillbee", "SkillBee", "Education", "Learn spoken English in 30 days, by voice.", "Practice with an AI partner. Rs 149 a month.", "Would you start this week?"),
  card("p-sareelink", "SareeLink", "Fashion", "Sell sarees on WhatsApp with a ready catalogue.", "Rs 299 a month, 100 products.", "Would you sell this way?"),
  card("p-rentwise", "RentWise", "Real estate", "Collect rent on time, with automatic reminders.", "Free for 3 tenants, Rs 99 per tenant after.", "Would you manage rent this way?"),
  card("p-cropdoc", "CropDoc", "Agriculture", "Send a photo of the leaf. Get the fix in a minute.", "Free for 5 photos a month.", "Would you use this in your field?"),
  card("p-standup", "StandUp", "SaaS", "Daily team updates in 60 seconds, by voice.", "Rs 150 per person a month.", "Would your team use this?"),
  card("p-gymbuddy", "GymBuddy", "Fitness", "Find a workout partner at your gym.", "Match by time and goal. Free.", "Would you try it?"),
  card("p-kidsfit", "KidsClub", "Kids", "After-school classes near you, booked in one app.", "Drawing, coding, football. From Rs 800 a month.", "Would you enrol your child?"),
];

const check = (c: LibraryCard, expected: Answer): LibraryCard => ({ ...c, yesLabel: "Yes", noLabel: "No", expected });

/** Instructed-item check cards (spec 04 §5.8). They look like normal cards but say which answer to pick. */
export const CHECK_CARDS: readonly LibraryCard[] = [
  check(card("c-lassi", "LassiLane", "Food", "Cold lassi from the best shops in town.", "Rs 40 a glass, delivered in 20 minutes.", "Quick check: pick No on this one."), "no"),
  check(card("c-booknest", "BookNest", "Education", "Second-hand school books, half the price.", "Free pickup from your door.", "Quick check: pick Yes on this one."), "yes"),
  check(card("c-spinwheel", "SpinWheel", "Gaming", "Spin and win small prizes every day.", "Free to play, no ads.", "To show you are reading, pick No here."), "no"),
  check(card("c-cabshare", "CabShare", "Travel", "Share a cab to the airport and save 40%.", "Pre-book up to 7 days ahead.", "To show you are reading, pick Yes here."), "yes"),
  check(card("c-petfood", "PetPantry", "Pets", "Fresh pet food, delivered weekly.", "Plans from Rs 599 a month.", "Attention check: tap No for this card."), "no"),
  check(card("c-yogaloop", "YogaLoop", "Fitness", "Ten-minute yoga for desk workers.", "Rs 99 a month.", "Attention check: tap Yes for this card."), "yes"),
];

const BY_ID = new Map<string, LibraryCard>([...NORMAL_CARDS, ...CHECK_CARDS].map((c) => [c.id, c]));

export const getLibraryCard = (id: string): LibraryCard | undefined => BY_ID.get(id);

/** Strips the answer key. Always send cards to the browser through this. */
export function toPublicCard(c: LibraryCard): PracticeCard {
  const { expected, ...rest } = c;
  void expected;
  return rest;
}
