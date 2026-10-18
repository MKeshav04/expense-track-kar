export const DEFAULT_CATEGORIES = [
  {
    id: 'food',
    name: 'Food',
    emoji: '🍔',
    aliases: ['meal', 'meals', 'lunch', 'dinner', 'breakfast', 'snack', 'snacks', 'chai', 'tea', 'coffee', 'restaurant', 'eating out'],
  },
  {
    id: 'groceries',
    name: 'Groceries',
    emoji: '🛒',
    aliases: ['grocery', 'vegetables', 'veggies', 'sabzi', 'milk', 'fruits', 'kirana'],
  },
  {
    id: 'transport',
    name: 'Transport',
    emoji: '🛺',
    aliases: ['travel', 'auto', 'cab', 'taxi', 'bus', 'metro', 'train', 'petrol', 'fuel', 'diesel', 'parking', 'toll'],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    emoji: '🛍️',
    aliases: ['shop', 'clothes', 'shoes'],
  },
  {
    id: 'bills',
    name: 'Bills',
    emoji: '🧾',
    aliases: ['bill', 'rent', 'electricity', 'recharge', 'wifi', 'internet', 'emi', 'subscription'],
  },
  {
    id: 'care',
    name: 'Care',
    emoji: '💊',
    aliases: ['health', 'medicine', 'medicines', 'doctor', 'pharmacy', 'salon', 'haircut', 'gym', 'hospital'],
  },
  {
    id: 'fun',
    name: 'Fun',
    emoji: '🎉',
    aliases: ['movie', 'movies', 'party', 'drinks', 'outing', 'game', 'games', 'trip'],
  },
  {
    id: 'other',
    name: 'Other',
    emoji: '📦',
    aliases: ['misc'],
  },
].map((c, i) => ({ ...c, order: i }))

// Common Indian merchants. Seeded into keyword memory on first launch.
export const SEED_KEYWORDS = {
  food: ['swiggy', 'zomato', 'dominos', 'mcdonalds', 'kfc', 'starbucks', 'eatsure'],
  groceries: ['blinkit', 'zepto', 'bigbasket', 'instamart', 'dmart', 'jiomart'],
  transport: ['uber', 'ola', 'rapido', 'irctc', 'redbus', 'indigo', 'namma'],
  shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'decathlon'],
  bills: ['netflix', 'spotify', 'hotstar', 'jio', 'airtel', 'bescom'],
  care: ['pharmeasy', 'apollo', 'netmeds', '1mg', 'cult'],
  fun: ['bookmyshow', 'pvr', 'inox'],
}
