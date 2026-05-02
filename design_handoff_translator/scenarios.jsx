// Realistic scenario data for the Translator prototype.
// Each scenario simulates the full pipeline output: bucket label (internal,
// never shown to users), the user's typed input, and the final translated
// answer that the post-processor would have shipped.

const SCENARIOS = {
  decode: {
    id: "decode",
    bucket: "DECODE",
    label: "A letter from Medicare",
    starter: "I got a letter I don't understand",
    prefill: "I got a letter from ",
    input:
      "I got a letter from Medicare saying my Part B premium is going up to $185.00 starting January 1st. The letter has policy number M-4471-882-X. I don't understand what they're asking me to do.",
    answer: [
      "Your Medicare letter is telling you about a price change. Starting January 1st, your Part B premium will be $185.00 per month. That is the new amount Medicare will charge you.",
      "You do not need to do anything. Medicare will start charging the new amount automatically. If your premium is taken out of your Social Security check, the change happens there too.",
      "Your policy number is M-4471-882-X. Keep this letter for your records.",
      "If you want to confirm the change, you can call Medicare at 1-800-MEDICARE.",
    ],
    tone: "calm", // styling: calm | alert | warm
  },

  verify: {
    id: "verify",
    bucket: "VERIFY",
    label: "Is this a scam?",
    starter: "Is this a scam?",
    prefill: "I think this might be a scam. Here's what I got: ",
    input:
      "Someone called saying they're from the IRS and I owe $4,200 in back taxes and need to pay in iTunes gift cards today by 5pm or a warrant will be issued for my arrest. They gave me a case number 88-4471-A.",
    answer: [
      "This is a scam. Do not call back. Do not buy any gift cards. Do not give them any information.",
      "Here is how you know:",
      "• The real IRS never calls demanding payment in gift cards. Ever.",
      "• The real IRS never threatens arrest over the phone.",
      "• The real IRS contacts you by mail first, not by phone.",
      "• A demand for $4,200 by 5pm is a pressure tactic. Real tax matters take weeks.",
      "What to do: hang up if they call again. Block the number. If you are worried you actually owe taxes, call the IRS yourself at 1-800-829-1040.",
      "You can report this scam to the Treasury Inspector General at 1-800-366-4484.",
    ],
    tone: "alert",
  },

  respond: {
    id: "respond",
    bucket: "RESPOND",
    label: "Reply to a message",
    starter: "Help me reply to a message",
    prefill: "I need to reply to this message: ",
    input:
      "My grandson Marcus texted me this: 'Hey grandma! I got into the engineering program at State! Mom told me you helped with the application fee. Thank you so much. Want to come to the open house with us on April 12?' I want to write back but I'm not great at texting.",
    answer: [
      "Marcus, that is wonderful news. Congratulations on getting into the engineering program. I am so proud of you.",
      "I would love to come to the open house on April 12. Just tell me what time and I will be there.",
      "Love, Grandma",
    ],
    tone: "warm",
  },

  compose: {
    id: "compose",
    bucket: "COMPOSE",
    label: "Write a thank-you note",
    starter: "Write a note for me",
    prefill: "I want to write a note to ",
    input:
      "I want to write a thank-you note to my neighbor Janet who brought us soup and bread three times last week while I was recovering from knee surgery. She also walked our dog Biscuit twice. I want it to feel sincere but not too fancy.",
    answer: [
      "Dear Janet,",
      "Thank you for the soup and bread last week. It meant more than you know. Three meals when I could barely stand up was a real gift, and the bread was the best I have had in years.",
      "Thank you also for walking Biscuit. He sleeps better on the days he gets a long walk, and I do too.",
      "I am back on my feet now. The next pot of soup is on me.",
      "With gratitude,",
    ],
    tone: "warm",
  },

  explain: {
    id: "explain",
    bucket: "EXPLAIN",
    label: "Explain something",
    starter: "Explain something to me",
    prefill: "Can you explain ",
    input:
      "Can you explain what a Roth conversion is? My financial advisor keeps bringing it up and I nod along but I don't really know what she means.",
    answer: [
      "A Roth conversion is moving money from one kind of retirement account to another.",
      "Think of it like two buckets:",
      "• A traditional IRA is the 'pay taxes later' bucket. You did not pay taxes on the money when it went in. You will pay taxes when you take it out.",
      "• A Roth IRA is the 'pay taxes now' bucket. You pay taxes on the money going in. When you take it out, no more taxes.",
      "A Roth conversion moves money from the first bucket to the second. You pay the taxes today so you do not have to later.",
      "People do this when they think their tax rate will be higher in the future, or when they want to leave money to family without a tax bill attached.",
      "Whether it makes sense for you depends on your tax situation. This is a good question to bring back to your advisor.",
    ],
    tone: "calm",
  },

  plan: {
    id: "plan",
    bucket: "PLAN",
    label: "Make a plan",
    starter: "Make a plan with me",
    prefill: "I need a plan for ",
    input:
      "I need a plan for disputing a charge on my Visa card. There's a charge for $89.43 from a company called 'NWPRINT SERVICES' that I never authorized. The charge posted on March 18.",
    answer: [
      "Here is what to do, in order.",
      "1. Find the phone number on the back of your Visa card. It is usually a 1-800 number.",
      "2. Call that number. Tell them: 'I want to dispute a charge.'",
      "3. Have these ready when they ask: the date (March 18), the amount ($89.43), and the company name (NWPRINT SERVICES).",
      "4. Tell them you did not authorize the charge. They will open a dispute and usually credit your account right away while they investigate.",
      "5. Write down the case number they give you. Keep it somewhere safe.",
      "6. Watch your statements for the next two months. The credit should stay. If the charge comes back, call again with your case number.",
      "7. If your card number was stolen, ask them to send you a new card. This is free and takes about a week.",
      "Most disputes are resolved in your favor within 30-60 days.",
    ],
    tone: "calm",
  },

  decide: {
    id: "decide",
    bucket: "DECIDE",
    label: "Help me decide",
    starter: "Help me decide between two options",
    prefill: "I'm trying to decide between ",
    input:
      "I'm trying to decide between taking my pension as a lump sum of $312,000 or as a monthly annuity of $1,640 for life. I'm 67. My husband is 71 and in good health.",
    answer: [
      "Here are the things to weigh. This is your decision to make, not mine.",
      "Reasons people pick the lump sum ($312,000):",
      "• You control the money. You can invest it, spend it, or leave it to family.",
      "• If you both pass away early, the remaining money goes to your heirs.",
      "• You are not tied to the pension company staying healthy.",
      "Reasons people pick the monthly annuity ($1,640/month):",
      "• You cannot outlive it. The check comes every month for the rest of your life.",
      "• You do not have to manage investments or worry about market drops.",
      "• Over 20 years, that is $393,600. Over 30 years, $590,400.",
      "Two questions worth asking:",
      "• Does the annuity continue for your husband if you pass first? Many pensions offer a 'joint and survivor' option at a lower monthly amount.",
      "• Are you comfortable managing $312,000, or would that feel stressful?",
      "Before you decide, please bring this to a fee-only financial advisor or a CPA. This is a decision worth a one-hour meeting.",
    ],
    tone: "calm",
  },

  create: {
    id: "create",
    bucket: "CREATE",
    label: "Help me write something special",
    starter: "Write something special",
    prefill: "I'd like help writing a ",
    input:
      "I'd like help writing a short toast for my daughter Eleanor's 40th birthday. She's a teacher, she's stubborn in the best way, she raised two great kids, and she still calls me every Sunday.",
    answer: [
      "To Eleanor.",
      "Forty years ago I held you for the first time and thought, this one is going to do things her way. I was right.",
      "You became a teacher, which is the work of patient people. You raised two children who are kind, which is the proof of patient work. And every Sunday you call your mother, which is the sign of a good heart.",
      "Stubborn in the best way. The way that gets things done. The way that holds a family together.",
      "Happy birthday, my darling. Here's to forty more.",
    ],
    tone: "warm",
  },
};

// Order shown in the starter examples list and the demo picker.
const SCENARIO_ORDER = [
  "decode",
  "verify",
  "respond",
  "compose",
  "explain",
  "plan",
  "decide",
  "create",
];

window.SCENARIOS = SCENARIOS;
window.SCENARIO_ORDER = SCENARIO_ORDER;
