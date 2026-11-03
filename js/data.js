// Nội dung học: bài kiểm tra đầu vào, lộ trình A1–C2, huy hiệu.
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// 4 lứa tuổi: đổi nhãn bài học, tốc độ đọc mặc định và giọng điệu của gia sư AI.
const AGE_GROUPS = [
  { id: 'kid', icon: '🧒', name: 'Trẻ em', rate: 0.8 },
  { id: 'student', icon: '🎒', name: 'Học sinh – Sinh viên', rate: 0.95 },
  { id: 'worker', icon: '💼', name: 'Người đi làm', rate: 1 },
  { id: 'senior', icon: '👵', name: 'Người lớn tuổi', rate: 0.75 },
];

const LEVEL_INFO = {
  A1: { name: 'Mới bắt đầu', color: '#22c55e' },
  A2: { name: 'Sơ cấp', color: '#14b8a6' },
  B1: { name: 'Trung cấp', color: '#3b82f6' },
  B2: { name: 'Trung cấp cao', color: '#8b5cf6' },
  C1: { name: 'Cao cấp', color: '#f59e0b' },
  C2: { name: 'Thành thạo', color: '#ef4444' },
};

// Câu hỏi xếp lớp: sắp theo độ khó tăng dần, 2 câu mỗi cấp độ.
const PLACEMENT = [
  { level: 'A1', q: 'Hello! My name ___ Lan.', options: ['am', 'is', 'are', 'be'], answer: 1, why: 'Chủ ngữ "My name" là ngôi thứ ba số ít nên dùng "is".' },
  { level: 'A1', q: 'Chọn nghĩa đúng của "apple".', options: ['quả chuối', 'quả táo', 'quả cam', 'quả nho'], answer: 1, why: '"apple" nghĩa là quả táo (quả chuối: banana, quả cam: orange, quả nho: grape).' },
  { level: 'A2', q: 'Yesterday I ___ to the cinema with my friends.', options: ['go', 'goes', 'went', 'going'], answer: 2, why: '"Yesterday" (hôm qua) là thì quá khứ đơn: go → went.' },
  { level: 'A2', q: 'This bag is ___ than that one.', options: ['heavy', 'heavier', 'heaviest', 'more heavy'], answer: 1, why: 'Có "than" là so sánh hơn; tính từ ngắn tận cùng -y: heavy → heavier.' },
  { level: 'B1', q: 'I have lived here ___ 2015.', options: ['for', 'since', 'from', 'during'], answer: 1, why: '"since" + mốc thời gian (2015); "for" + khoảng thời gian (5 years).' },
  { level: 'B1', q: 'If it rains tomorrow, we ___ at home.', options: ['stay', 'stayed', 'will stay', 'would stay'], answer: 2, why: 'Câu điều kiện loại 1: If + hiện tại đơn, will + động từ nguyên mẫu.' },
  { level: 'B2', q: 'The report ___ by the manager before the meeting started.', options: ['had been checked', 'has checked', 'was checking', 'checks'], answer: 0, why: 'Việc kiểm tra xảy ra trước một việc khác trong quá khứ, ở thể bị động: had been + V3.' },
  { level: 'B2', q: 'I wish I ___ more time to travel last year.', options: ['have', 'had', 'had had', 'would have'], answer: 2, why: 'Ước về quá khứ ("last year"): wish + quá khứ hoàn thành (had had).' },
  { level: 'C1', q: '___ had I arrived than the phone started ringing.', options: ['Hardly', 'No sooner', 'Barely', 'Scarcely'], answer: 1, why: 'Cấu trúc đảo ngữ "No sooner had ... than ..." (vừa mới ... thì ...). Hardly/Barely/Scarcely đi với "when".' },
  { level: 'C1', q: 'Chọn từ gần nghĩa nhất với "meticulous".', options: ['careless', 'thorough', 'generous', 'anxious'], answer: 1, why: '"meticulous" = tỉ mỉ, kỹ lưỡng, gần nghĩa nhất với "thorough".' },
  { level: 'C2', q: 'His argument, though superficially persuasive, does not ___ scrutiny.', options: ['bear up to', 'stand up to', 'hold on to', 'put up with'], answer: 1, why: 'Cụm "stand up to scrutiny" = đứng vững trước sự xem xét kỹ lưỡng.' },
  { level: 'C2', q: 'Chọn nghĩa đúng của "to pay lip service to".', options: ['ủng hộ nhiệt tình', 'chỉ nói suông, không làm thật', 'trả tiền trước', 'phê phán gay gắt'], answer: 1, why: '"pay lip service to" = nói ủng hộ ngoài miệng nhưng không làm thật.' },
];

// Mỗi bài theo 5 bước: warmup → intro (vocab + grammar) → practice → apply → review.
const LESSONS = [
  // ---------- A1 ----------
  {
    id: 'a1-1', level: 'A1', title: 'Chào hỏi & giới thiệu bản thân', skill: 'Giao tiếp', icon: '👋',
    warmup: { q: 'Khi gặp ai đó lần đầu, bạn nói gì?', options: ['Goodbye!', 'Nice to meet you!', 'Good night!'], answer: 1 },
    vocab: [
      { en: 'hello', vi: 'xin chào', ex: 'Hello, I am Minh.' },
      { en: 'name', vi: 'tên', ex: 'What is your name?' },
      { en: 'nice to meet you', vi: 'rất vui được gặp bạn', ex: 'Nice to meet you, Lan!' },
      { en: 'from', vi: 'đến từ', ex: 'I am from Vietnam.' },
      { en: 'friend', vi: 'bạn bè', ex: 'She is my friend.' },
      { en: 'goodbye', vi: 'tạm biệt', ex: 'Goodbye, see you tomorrow!' },
    ],
    grammar: { title: 'Động từ "to be": am / is / are', body: '<b>I am</b> · <b>He/She/It is</b> · <b>You/We/They are</b>.<br>Ví dụ: <i>I am a student. She is from Hanoi. They are my friends.</i>' },
    exercises: [
      { type: 'mc', q: 'They ___ my classmates.', options: ['am', 'is', 'are'], answer: 2 },
      { type: 'match', pairs: [['hello', 'xin chào'], ['friend', 'bạn bè'], ['goodbye', 'tạm biệt'], ['name', 'tên']] },
      { type: 'order', words: ['name', 'is', 'My', 'Minh'], answer: 'My name is Minh' },
      { type: 'listen', text: 'Nice to meet you', answer: 'nice to meet you' },
      { type: 'mc', q: '"Bạn đến từ đâu?" trong tiếng Anh là:', options: ['Where are you from?', 'How are you?', 'What is your name?'], answer: 0 },
    ],
    apply: { type: 'speak', prompt: 'Hãy tự giới thiệu: đọc to câu sau', target: 'Hello, my name is Lan and I am from Vietnam' },
  },
  {
    id: 'a1-2', level: 'A1', title: 'Gia đình của tôi', skill: 'Từ vựng', icon: '👨‍👩‍👧',
    warmup: { q: '"Mother" nghĩa là gì?', options: ['bố', 'mẹ', 'anh trai'], answer: 1 },
    vocab: [
      { en: 'father', vi: 'bố', ex: 'My father is a teacher.' },
      { en: 'mother', vi: 'mẹ', ex: 'My mother cooks very well.' },
      { en: 'brother', vi: 'anh/em trai', ex: 'I have one brother.' },
      { en: 'sister', vi: 'chị/em gái', ex: 'My sister is ten years old.' },
      { en: 'grandparents', vi: 'ông bà', ex: 'My grandparents live in Hue.' },
      { en: 'family', vi: 'gia đình', ex: 'I love my family.' },
    ],
    grammar: { title: 'Have / Has', body: '<b>I/You/We/They have</b> · <b>He/She/It has</b>.<br>Ví dụ: <i>I have two sisters. He has a dog.</i>' },
    exercises: [
      { type: 'mc', q: 'She ___ a big family.', options: ['have', 'has', 'is'], answer: 1 },
      { type: 'match', pairs: [['father', 'bố'], ['sister', 'chị/em gái'], ['family', 'gia đình'], ['grandparents', 'ông bà']] },
      { type: 'order', words: ['have', 'I', 'brother', 'one'], answer: 'I have one brother' },
      { type: 'listen', text: 'I love my family', answer: 'i love my family' },
    ],
    apply: { type: 'write', prompt: 'Viết 2–3 câu giới thiệu về gia đình bạn (dùng have/has).', minWords: 8 },
  },
  {
    id: 'a1-3', level: 'A1', title: 'Con vật & màu sắc', skill: 'Từ vựng', icon: '🐶',
    warmup: { q: '"Cat" là con gì?', options: ['con chó', 'con mèo', 'con chim'], answer: 1 },
    vocab: [
      { en: 'cat', vi: 'con mèo', ex: 'The cat is black.' },
      { en: 'dog', vi: 'con chó', ex: 'My dog is very friendly.' },
      { en: 'bird', vi: 'con chim', ex: 'The bird can sing.' },
      { en: 'red', vi: 'màu đỏ', ex: 'I like red apples.' },
      { en: 'blue', vi: 'màu xanh dương', ex: 'The sky is blue.' },
      { en: 'yellow', vi: 'màu vàng', ex: 'The banana is yellow.' },
    ],
    grammar: { title: 'This is / These are', body: '<b>This is</b> + 1 vật: <i>This is a cat.</i><br><b>These are</b> + nhiều vật: <i>These are dogs.</i><br>Màu sắc: <i>It <b>is</b> red. They <b>are</b> blue.</i>' },
    exercises: [
      { type: 'mc', q: '___ are my birds.', options: ['This', 'These', 'It'], answer: 1 },
      { type: 'match', pairs: [['cat', 'con mèo'], ['dog', 'con chó'], ['red', 'màu đỏ'], ['yellow', 'màu vàng']] },
      { type: 'order', words: ['is', 'The', 'blue', 'sky'], answer: 'The sky is blue' },
      { type: 'listen', text: 'The cat is black', answer: 'the cat is black' },
    ],
    apply: { type: 'speak', prompt: 'Đọc to câu sau:', target: 'This is a red bird' },
  },
  // ---------- A2 ----------
  {
    id: 'a2-1', level: 'A2', title: 'Kể về ngày hôm qua', skill: 'Ngữ pháp', icon: '📅',
    warmup: { q: 'Quá khứ của "go" là gì?', options: ['goed', 'went', 'gone'], answer: 1 },
    vocab: [
      { en: 'yesterday', vi: 'hôm qua', ex: 'I visited my aunt yesterday.' },
      { en: 'last week', vi: 'tuần trước', ex: 'We watched a film last week.' },
      { en: 'visit', vi: 'thăm', ex: 'They visited the museum.' },
      { en: 'buy', vi: 'mua', ex: 'She bought a new phone.' },
      { en: 'tired', vi: 'mệt', ex: 'I was very tired after work.' },
      { en: 'weekend', vi: 'cuối tuần', ex: 'What did you do at the weekend?' },
    ],
    grammar: { title: 'Thì quá khứ đơn', body: 'Động từ có quy tắc thêm <b>-ed</b> (<i>play → played</i>). Bất quy tắc phải học thuộc (<i>go → went, buy → bought, see → saw</i>).<br>Phủ định: <i>I <b>didn\'t</b> go.</i> Câu hỏi: <i><b>Did</b> you go?</i>' },
    exercises: [
      { type: 'mc', q: 'We ___ football last Sunday.', options: ['play', 'played', 'playing'], answer: 1 },
      { type: 'mc', q: 'She ___ a new dress yesterday.', options: ['buyed', 'buys', 'bought'], answer: 2 },
      { type: 'order', words: ['you', 'Did', 'the', 'visit', 'museum'], answer: 'Did you visit the museum' },
      { type: 'match', pairs: [['yesterday', 'hôm qua'], ['tired', 'mệt'], ['weekend', 'cuối tuần'], ['buy', 'mua']] },
      { type: 'listen', text: 'I was very tired', answer: 'i was very tired' },
    ],
    apply: { type: 'write', prompt: 'Viết 3 câu kể việc bạn đã làm cuối tuần trước.', minWords: 12 },
  },
  {
    id: 'a2-2', level: 'A2', title: 'Gọi món tại quán cà phê', skill: 'Giao tiếp', icon: '☕',
    warmup: { q: 'Cách lịch sự để gọi món là:', options: ['Give me coffee.', 'I would like a coffee, please.', 'Coffee now.'], answer: 1 },
    vocab: [
      { en: 'menu', vi: 'thực đơn', ex: 'Can I see the menu, please?' },
      { en: 'order', vi: 'gọi món', ex: 'Are you ready to order?' },
      { en: 'bill', vi: 'hóa đơn', ex: 'Could we have the bill?' },
      { en: 'iced', vi: 'có đá', ex: 'An iced milk coffee, please.' },
      { en: 'take away', vi: 'mang đi', ex: 'Is it for here or take away?' },
      { en: 'how much', vi: 'bao nhiêu (tiền)', ex: 'How much is it?' },
    ],
    grammar: { title: 'Would like / Can / Could', body: '<i>I <b>would like</b> a tea.</i> (lịch sự hơn <i>I want</i>)<br><i><b>Can</b> I have...? / <b>Could</b> I have...?</i> — dùng để yêu cầu lịch sự.' },
    exercises: [
      { type: 'mc', q: '___ I have the bill, please?', options: ['Could', 'Would', 'Am'], answer: 0 },
      { type: 'order', words: ['like', 'I', 'tea', 'would', 'a'], answer: 'I would like a tea' },
      { type: 'match', pairs: [['menu', 'thực đơn'], ['bill', 'hóa đơn'], ['take away', 'mang đi'], ['order', 'gọi món']] },
      { type: 'listen', text: 'How much is it', answer: 'how much is it' },
    ],
    apply: { type: 'speak', prompt: 'Gọi một ly cà phê sữa đá:', target: 'Could I have an iced milk coffee to take away please' },
  },
  {
    id: 'a2-3', level: 'A2', title: 'Sức khỏe & đi khám bệnh', skill: 'Giao tiếp', icon: '🩺',
    warmup: { q: '"Headache" nghĩa là gì?', options: ['đau bụng', 'đau đầu', 'đau lưng'], answer: 1 },
    vocab: [
      { en: 'headache', vi: 'đau đầu', ex: 'I have a bad headache.' },
      { en: 'medicine', vi: 'thuốc', ex: 'Take this medicine twice a day.' },
      { en: 'appointment', vi: 'cuộc hẹn', ex: 'I have an appointment at nine.' },
      { en: 'blood pressure', vi: 'huyết áp', ex: 'The nurse checked my blood pressure.' },
      { en: 'pharmacy', vi: 'hiệu thuốc', ex: 'Is there a pharmacy near here?' },
      { en: 'feel better', vi: 'thấy khỏe hơn', ex: 'I hope you feel better soon.' },
    ],
    grammar: { title: 'Should / Shouldn\'t', body: 'Dùng để khuyên: <i>You <b>should</b> rest. You <b>shouldn\'t</b> eat too much salt.</i><br>Hỏi ý kiến: <i><b>Should</b> I take this medicine after meals?</i>' },
    exercises: [
      { type: 'mc', q: 'You have a fever. You ___ stay in bed.', options: ['should', 'shouldn\'t', 'are'], answer: 0 },
      { type: 'match', pairs: [['headache', 'đau đầu'], ['medicine', 'thuốc'], ['pharmacy', 'hiệu thuốc'], ['appointment', 'cuộc hẹn']] },
      { type: 'order', words: ['feel', 'hope', 'I', 'better', 'you'], answer: 'I hope you feel better' },
      { type: 'listen', text: 'I have a bad headache', answer: 'i have a bad headache' },
    ],
    apply: { type: 'speak', prompt: 'Gọi điện đặt lịch khám:', target: 'I would like to make an appointment with the doctor please' },
  },
  // ---------- B1 ----------
  {
    id: 'b1-1', level: 'B1', title: 'Kinh nghiệm & trải nghiệm', skill: 'Ngữ pháp', icon: '🌍',
    warmup: { q: '"Have you ever...?" dùng để hỏi về:', options: ['kế hoạch tương lai', 'trải nghiệm từ trước đến nay', 'thói quen hằng ngày'], answer: 1 },
    vocab: [
      { en: 'experience', vi: 'trải nghiệm', ex: 'It was an amazing experience.' },
      { en: 'abroad', vi: 'ở nước ngoài', ex: 'Have you ever studied abroad?' },
      { en: 'recently', vi: 'gần đây', ex: 'I have recently started yoga.' },
      { en: 'already', vi: 'đã... rồi', ex: 'She has already finished.' },
      { en: 'yet', vi: 'chưa (phủ định/hỏi)', ex: 'I haven\'t eaten yet.' },
      { en: 'achievement', vi: 'thành tựu', ex: 'Passing the exam was a big achievement.' },
    ],
    grammar: { title: 'Hiện tại hoàn thành', body: '<b>have/has + V3</b>: trải nghiệm hoặc việc có liên quan đến hiện tại.<br><i>I <b>have been</b> to Japan. She <b>has</b> never <b>tried</b> sushi.</i><br><b>for</b> + khoảng thời gian, <b>since</b> + mốc thời gian.' },
    exercises: [
      { type: 'mc', q: 'I have known her ___ ten years.', options: ['since', 'for', 'ago'], answer: 1 },
      { type: 'mc', q: 'Have you finished your homework ___?', options: ['already', 'yet', 'ever'], answer: 1 },
      { type: 'order', words: ['ever', 'you', 'Have', 'abroad', 'been'], answer: 'Have you ever been abroad' },
      { type: 'match', pairs: [['abroad', 'ở nước ngoài'], ['recently', 'gần đây'], ['achievement', 'thành tựu'], ['experience', 'trải nghiệm']] },
      { type: 'listen', text: 'She has already finished', answer: 'she has already finished' },
    ],
    apply: { type: 'write', prompt: 'Viết đoạn văn ngắn (3–4 câu) về một trải nghiệm đáng nhớ, dùng thì hiện tại hoàn thành.', minWords: 25 },
  },
  {
    id: 'b1-2', level: 'B1', title: 'Đi du lịch & hỏi đường', skill: 'Nghe – Nói', icon: '🧭',
    warmup: { q: '"Go straight" nghĩa là:', options: ['rẽ trái', 'đi thẳng', 'quay lại'], answer: 1 },
    vocab: [
      { en: 'turn left', vi: 'rẽ trái', ex: 'Turn left at the traffic lights.' },
      { en: 'opposite', vi: 'đối diện', ex: 'The bank is opposite the park.' },
      { en: 'book', vi: 'đặt (phòng, vé)', ex: 'I booked a room online.' },
      { en: 'luggage', vi: 'hành lý', ex: 'Where can I leave my luggage?' },
      { en: 'sightseeing', vi: 'tham quan', ex: 'We went sightseeing in Hoi An.' },
      { en: 'nearby', vi: 'gần đây', ex: 'Is there a pharmacy nearby?' },
    ],
    grammar: { title: 'Câu điều kiện loại 1', body: '<b>If + hiện tại đơn, will + V</b>: điều có thể xảy ra.<br><i>If you <b>turn</b> left, you <b>will see</b> the station.</i>' },
    exercises: [
      { type: 'mc', q: 'If you hurry, you ___ the bus.', options: ['catch', 'will catch', 'caught'], answer: 1 },
      { type: 'order', words: ['the', 'is', 'opposite', 'bank', 'park', 'The'], answer: 'The bank is opposite the park' },
      { type: 'match', pairs: [['luggage', 'hành lý'], ['nearby', 'gần đây'], ['opposite', 'đối diện'], ['sightseeing', 'tham quan']] },
      { type: 'listen', text: 'Is there a pharmacy nearby', answer: 'is there a pharmacy nearby' },
    ],
    apply: { type: 'speak', prompt: 'Hỏi đường đến ga tàu:', target: 'Excuse me could you tell me how to get to the train station' },
  },
  // ---------- B2 ----------
  {
    id: 'b2-1', level: 'B2', title: 'Môi trường & xã hội', skill: 'Đọc – Viết', icon: '🌱',
    warmup: { q: '"Pollution" nghĩa là:', options: ['ô nhiễm', 'dân số', 'chính sách'], answer: 0 },
    vocab: [
      { en: 'sustainable', vi: 'bền vững', ex: 'We need sustainable energy.' },
      { en: 'reduce', vi: 'giảm', ex: 'We should reduce plastic waste.' },
      { en: 'consequence', vi: 'hậu quả', ex: 'Climate change has serious consequences.' },
      { en: 'awareness', vi: 'nhận thức', ex: 'The campaign raised public awareness.' },
      { en: 'implement', vi: 'thực hiện, triển khai', ex: 'The city implemented a new policy.' },
      { en: 'significantly', vi: 'đáng kể', ex: 'Emissions fell significantly.' },
    ],
    grammar: { title: 'Câu bị động', body: '<b>be + V3</b>: nhấn mạnh hành động hơn người làm.<br><i>Thousands of trees <b>are cut down</b> every year. A new law <b>has been passed</b>.</i>' },
    exercises: [
      { type: 'mc', q: 'A new recycling scheme ___ last month.', options: ['introduced', 'was introduced', 'has introducing'], answer: 1 },
      { type: 'mc', q: 'Chọn từ phù hợp: "We must ___ our carbon footprint."', options: ['reduce', 'increase', 'consequence'], answer: 0 },
      { type: 'order', words: ['raised', 'was', 'Public', 'awareness', 'significantly'], answer: 'Public awareness was raised significantly' },
      { type: 'match', pairs: [['sustainable', 'bền vững'], ['consequence', 'hậu quả'], ['awareness', 'nhận thức'], ['implement', 'triển khai']] },
    ],
    apply: { type: 'write', prompt: 'Viết đoạn văn (4–5 câu) nêu ý kiến: "Các thành phố nên cấm túi nilon". Dùng ít nhất 1 câu bị động.', minWords: 40 },
  },
  {
    id: 'b2-2', level: 'B2', title: 'Phỏng vấn xin việc', skill: 'Giao tiếp', icon: '💼',
    warmup: { q: 'Câu nào phù hợp trong buổi phỏng vấn?', options: ['I want money.', 'I\'m keen to develop my skills in this role.', 'Whatever.'], answer: 1 },
    vocab: [
      { en: 'strength', vi: 'điểm mạnh', ex: 'My main strength is teamwork.' },
      { en: 'deadline', vi: 'hạn chót', ex: 'I always meet deadlines.' },
      { en: 'responsible for', vi: 'chịu trách nhiệm', ex: 'I was responsible for a team of five.' },
      { en: 'qualification', vi: 'bằng cấp', ex: 'What qualifications do you have?' },
      { en: 'challenge', vi: 'thử thách', ex: 'Tell me about a challenge you faced.' },
      { en: 'keen', vi: 'háo hức, mong muốn', ex: 'I am keen to learn.' },
    ],
    grammar: { title: 'Câu điều kiện loại 2 & 3', body: 'Loại 2: <i>If I <b>were</b> the manager, I <b>would</b> change it.</i> (không có thật ở hiện tại)<br>Loại 3: <i>If I <b>had prepared</b>, I <b>would have passed</b>.</i> (không có thật trong quá khứ)' },
    exercises: [
      { type: 'mc', q: 'If I ___ more experience, I would apply for that job.', options: ['have', 'had', 'will have'], answer: 1 },
      { type: 'mc', q: 'If she had left earlier, she ___ the deadline.', options: ['would meet', 'would have met', 'will meet'], answer: 1 },
      { type: 'order', words: ['strength', 'My', 'is', 'main', 'teamwork'], answer: 'My main strength is teamwork' },
      { type: 'listen', text: 'I always meet deadlines', answer: 'i always meet deadlines' },
    ],
    apply: { type: 'speak', prompt: 'Trả lời câu "Tell me about yourself":', target: 'I am a hardworking person and I am keen to develop my skills in this role' },
  },
  // ---------- C1 ----------
  {
    id: 'c1-1', level: 'C1', title: 'Đảo ngữ để nhấn mạnh', skill: 'Ngữ pháp', icon: '🔄',
    warmup: { q: 'Câu nào đúng?', options: ['Never I have seen this.', 'Never have I seen this.', 'Never I saw this.'], answer: 1 },
    vocab: [
      { en: 'rarely', vi: 'hiếm khi', ex: 'Rarely do we see such talent.' },
      { en: 'under no circumstances', vi: 'trong bất kỳ hoàn cảnh nào cũng không', ex: 'Under no circumstances should you share your password.' },
      { en: 'not only... but also', vi: 'không những... mà còn', ex: 'Not only is she smart, but she is also kind.' },
      { en: 'unprecedented', vi: 'chưa từng có', ex: 'The pandemic caused unprecedented disruption.' },
      { en: 'profound', vi: 'sâu sắc', ex: 'The book had a profound impact on me.' },
      { en: 'little did I know', vi: 'tôi không hề biết', ex: 'Little did I know that she was lying.' },
    ],
    grammar: { title: 'Đảo ngữ (Inversion)', body: 'Trạng từ phủ định/hạn chế đứng đầu câu → đảo trợ động từ lên trước chủ ngữ.<br><i><b>Never have I</b> felt so proud. <b>Only then did she</b> realise. <b>No sooner had</b> we left <b>than</b> it rained.</i>' },
    exercises: [
      { type: 'mc', q: 'Rarely ___ such a beautiful sunset.', options: ['I have seen', 'have I seen', 'I saw'], answer: 1 },
      { type: 'mc', q: 'Not only ___ late, but he also forgot the tickets.', options: ['he was', 'was he', 'he is'], answer: 1 },
      { type: 'order', words: ['did', 'know', 'Little', 'I', 'truth', 'the'], answer: 'Little did I know the truth' },
      { type: 'match', pairs: [['rarely', 'hiếm khi'], ['unprecedented', 'chưa từng có'], ['profound', 'sâu sắc'], ['little did I know', 'tôi không hề biết']] },
    ],
    apply: { type: 'write', prompt: 'Viết lại 3 câu bất kỳ của bạn bằng cấu trúc đảo ngữ (Never, Rarely, Not only...).', minWords: 25 },
  },
  {
    id: 'c1-2', level: 'C1', title: 'Thuyết trình & lập luận', skill: 'Nói', icon: '🎤',
    warmup: { q: 'Cụm nào dùng để đưa ra phản biện?', options: ['On the other hand,', 'First of all,', 'In my family,'], answer: 0 },
    vocab: [
      { en: 'furthermore', vi: 'hơn nữa', ex: 'Furthermore, the costs are lower.' },
      { en: 'nevertheless', vi: 'tuy nhiên', ex: 'It was risky; nevertheless, we went ahead.' },
      { en: 'compelling', vi: 'thuyết phục', ex: 'She made a compelling argument.' },
      { en: 'to outline', vi: 'trình bày khái quát', ex: 'Let me outline the main points.' },
      { en: 'to address', vi: 'giải quyết, đề cập', ex: 'We need to address this issue.' },
      { en: 'in conclusion', vi: 'kết luận lại', ex: 'In conclusion, the plan is feasible.' },
    ],
    grammar: { title: 'Từ nối trong lập luận', body: 'Bổ sung: <i>furthermore, moreover, in addition</i><br>Tương phản: <i>nevertheless, nonetheless, whereas</i><br>Kết quả: <i>consequently, therefore, as a result</i>' },
    exercises: [
      { type: 'mc', q: 'The plan is expensive; ___, it will save money in the long run.', options: ['furthermore', 'nevertheless', 'therefore'], answer: 1 },
      { type: 'order', words: ['outline', 'me', 'main', 'Let', 'the', 'points'], answer: 'Let me outline the main points' },
      { type: 'match', pairs: [['furthermore', 'hơn nữa'], ['compelling', 'thuyết phục'], ['to address', 'giải quyết'], ['in conclusion', 'kết luận lại']] },
      { type: 'listen', text: 'She made a compelling argument', answer: 'she made a compelling argument' },
    ],
    apply: { type: 'speak', prompt: 'Mở đầu bài thuyết trình:', target: 'Good morning everyone today I would like to outline three compelling reasons to invest in education' },
  },
  // ---------- C2 ----------
  {
    id: 'c2-1', level: 'C2', title: 'Thành ngữ & sắc thái', skill: 'Từ vựng', icon: '🎭',
    warmup: { q: '"Break the ice" nghĩa là:', options: ['làm vỡ đá', 'phá vỡ bầu không khí ngại ngùng', 'làm hỏng việc'], answer: 1 },
    vocab: [
      { en: 'a blessing in disguise', vi: 'trong cái rủi có cái may', ex: 'Losing that job was a blessing in disguise.' },
      { en: 'to cut corners', vi: 'làm ẩu cho nhanh/rẻ', ex: 'Don\'t cut corners on safety.' },
      { en: 'to pay lip service to', vi: 'nói suông', ex: 'They only pay lip service to equality.' },
      { en: 'the elephant in the room', vi: 'vấn đề ai cũng biết nhưng né tránh', ex: 'Let\'s address the elephant in the room.' },
      { en: 'to get the ball rolling', vi: 'khởi động, bắt đầu', ex: 'Shall I get the ball rolling?' },
      { en: 'by the skin of one\'s teeth', vi: 'suýt soát, sát nút', ex: 'He passed by the skin of his teeth.' },
    ],
    grammar: { title: 'Câu chẻ (Cleft sentences)', body: 'Nhấn mạnh một thành phần:<br><i><b>It was</b> her honesty <b>that</b> impressed me.</i><br><i><b>What</b> I need <b>is</b> more time.</i><br><i><b>All</b> I did <b>was</b> ask a question.</i>' },
    exercises: [
      { type: 'mc', q: 'Failing the first exam turned out to be ___ — it made me study harder.', options: ['the elephant in the room', 'a blessing in disguise', 'cutting corners'], answer: 1 },
      { type: 'mc', q: '___ I need is a long holiday.', options: ['That', 'What', 'It'], answer: 1 },
      { type: 'order', words: ['her', 'It', 'honesty', 'was', 'impressed', 'that', 'me'], answer: 'It was her honesty that impressed me' },
      { type: 'match', pairs: [['to cut corners', 'làm ẩu'], ['to get the ball rolling', 'bắt đầu'], ['by the skin of one\'s teeth', 'sát nút'], ['to pay lip service to', 'nói suông']] },
    ],
    apply: { type: 'write', prompt: 'Viết một đoạn ngắn (5 câu) về công việc/học tập, dùng ít nhất 2 thành ngữ và 1 câu chẻ.', minWords: 45 },
  },
  {
    id: 'c2-2', level: 'C2', title: 'Tranh luận học thuật', skill: 'Đọc – Viết', icon: '🎓',
    warmup: { q: '"To concede a point" nghĩa là:', options: ['thừa nhận một luận điểm', 'phủ nhận hoàn toàn', 'tóm tắt'], answer: 0 },
    vocab: [
      { en: 'to concede', vi: 'thừa nhận', ex: 'I concede that the data is limited.' },
      { en: 'tenuous', vi: 'mong manh, yếu', ex: 'The link between the two is tenuous.' },
      { en: 'to substantiate', vi: 'chứng minh, làm rõ bằng chứng', ex: 'Can you substantiate that claim?' },
      { en: 'notwithstanding', vi: 'mặc dù, bất chấp', ex: 'Notwithstanding the risks, they proceeded.' },
      { en: 'paradigm', vi: 'mô hình, hệ tư tưởng', ex: 'This marks a paradigm shift.' },
      { en: 'to underpin', vi: 'làm nền tảng', ex: 'Trust underpins every relationship.' },
    ],
    grammar: { title: 'Rào đón (Hedging)', body: 'Viết học thuật tránh khẳng định tuyệt đối:<br><i>It <b>could be argued</b> that... · The evidence <b>appears to suggest</b>... · This <b>may</b> partly <b>account for</b>...</i>' },
    exercises: [
      { type: 'mc', q: 'The evidence ___ that sleep improves memory.', options: ['proves absolutely', 'appears to suggest', 'is knowing'], answer: 1 },
      { type: 'mc', q: '___ its flaws, the study remains influential.', options: ['Notwithstanding', 'Furthermore', 'Whereas'], answer: 0 },
      { type: 'order', words: ['be', 'It', 'argued', 'could', 'that'], answer: 'It could be argued that' },
      { type: 'match', pairs: [['tenuous', 'mong manh'], ['to substantiate', 'chứng minh'], ['paradigm', 'mô hình'], ['to underpin', 'làm nền tảng']] },
    ],
    apply: { type: 'write', prompt: 'Viết đoạn lập luận (5–6 câu): "AI sẽ thay thế giáo viên?" — dùng ngôn ngữ rào đón và ít nhất 1 lần thừa nhận quan điểm đối lập.', minWords: 60 },
  },
];

// Lứa tuổi phù hợp với từng bài (bài không có trong bảng: phù hợp mọi lứa tuổi).
const ALL_AGES = AGE_GROUPS.map(g => g.id);
const LESSON_AGES = {
  'a1-2': ['kid', 'student', 'senior'], 'a1-3': ['kid'],
  'a2-1': ['student', 'worker', 'senior'], 'a2-2': ['student', 'worker', 'senior'], 'a2-3': ['senior', 'worker'],
  'b1-1': ['student', 'worker'], 'b1-2': ['student', 'worker', 'senior'],
  'b2-1': ['student', 'worker'], 'b2-2': ['student', 'worker'],
  'c1-1': ['student', 'worker'], 'c1-2': ['student', 'worker'],
  'c2-1': ['student', 'worker'], 'c2-2': ['student', 'worker'],
};
for (const l of LESSONS) l.ages = LESSON_AGES[l.id] || ALL_AGES;

// Chủ đề học tập: nhóm các bài học có thật (dùng ở Trang chủ và Lộ trình).
const TOPICS = [
  { id: 'travel', icon: '✈️', name: 'Du lịch', cls: 'bg-travel', lessons: ['b1-2'] },
  { id: 'work', icon: '💼', name: 'Công việc', cls: 'bg-work', lessons: ['b2-2', 'c1-2'] },
  { id: 'daily', icon: '☕', name: 'Đời sống', cls: 'bg-daily', lessons: ['a1-1', 'a1-2', 'a1-3', 'a2-1', 'a2-2', 'a2-3'] },
  { id: 'school', icon: '🎓', name: 'Học thuật', cls: 'bg-school', lessons: ['b1-1', 'b2-1', 'c1-1', 'c2-1', 'c2-2'] },
];

const BADGES = [
  { id: 'first-lesson', icon: '🎯', name: 'Bước đầu tiên', desc: 'Hoàn thành bài học đầu tiên' },
  { id: 'perfect', icon: '💯', name: 'Hoàn hảo', desc: 'Hoàn thành một bài không sai câu nào' },
  { id: 'streak-3', icon: '🔥', name: 'Lửa nhỏ', desc: 'Chuỗi 3 ngày học liên tiếp' },
  { id: 'streak-7', icon: '🌋', name: 'Không thể cản', desc: 'Chuỗi 7 ngày học liên tiếp' },
  { id: 'xp-500', icon: '⭐', name: 'Ngôi sao', desc: 'Đạt 500 XP' },
  { id: 'xp-2000', icon: '🌟', name: 'Siêu sao', desc: 'Đạt 2000 XP' },
  { id: 'review-50', icon: '🧠', name: 'Trí nhớ thép', desc: 'Ôn 50 thẻ từ vựng' },
  { id: 'chat-1', icon: '🤖', name: 'Bạn của AI', desc: 'Trò chuyện lần đầu với gia sư AI' },
  { id: 'speaker', icon: '🗣️', name: 'Dám nói', desc: 'Đạt ≥80% ở bài luyện phát âm' },
  { id: 'certified', icon: '📜', name: 'Có chứng chỉ', desc: 'Vượt qua một bài kiểm tra cấp độ' },
  { id: 'quests', icon: '✅', name: 'Chăm chỉ', desc: 'Hoàn thành tất cả nhiệm vụ trong ngày' },
  { id: 'talker', icon: '🎙️', name: 'Chuyên gia giao tiếp', desc: 'Gửi 100 tin nhắn cho gia sư AI' },
  { id: 'champion', icon: '⚔️', name: 'Nhà vô địch', desc: 'Thắng AI ở Đấu trường' },
  { id: 'ai-explorer', icon: '✨', name: 'Nhà thám hiểm AI', desc: 'Dùng 5 lần công cụ trong Học cùng AI' },
  { id: 'pronouncer', icon: '🎯', name: 'Phát âm chuẩn', desc: 'Đạt ≥80% khi luyện phát âm 10 từ trong Từ điển' },
];

// Nhân vật / tình huống của gia sư AI. Nội dung vai diễn nằm trong js/prompts.js (scenarios).
const CHAT_SCENARIOS = [
  { id: 'free', icon: '💬', name: 'Trò chuyện tự do' },
  { id: 'friend', icon: '😎', name: 'Jake – bạn bản xứ' },
  { id: 'strict', icon: '👩‍💼', name: 'Ms. Carter – HR khó tính' },
  { id: 'guide', icon: '🧳', name: 'Hướng dẫn viên du lịch' },
  { id: 'cafe', icon: '☕', name: 'Quán cà phê' },
  { id: 'school', icon: '🏫', name: 'Ở trường học' },
  { id: 'doctor', icon: '🩺', name: 'Đi khám bệnh' },
];

// Avatar gia sư mở khóa dần khi thắng Đấu trường AI.
const TUTOR_AVATARS = ['🦉', '🤖', '🐱', '🦊', '🐼', '🦄', '🐉', '👽'];
