// Tiny i18n: English and Hindi. t(key, vars) falls back to English, then to the key itself.
// To translate another page: import { t } from '../i18n.js', add the keys to EN and HI below,
// and replace the literal string with t('your.key'). Placeholders look like {n}.
const KEY = 'ss_lang';

const EN = {
  'nav.home': 'Home', 'nav.focus': 'Focus', 'nav.quiz': 'Quiz', 'nav.contests': 'Contests', 'nav.leaderboard': 'Leaderboard',
  'nav.chat': 'Live chat', 'nav.doubts': 'Doubts', 'nav.research': 'Research', 'nav.books': 'Books',
  'auth.login': 'Log in', 'auth.signup': 'Sign up', 'auth.logout': 'Log out',
  'lang.switch': 'Switch language', 'skip': 'Skip to content', 'theme.switch': 'Change colour theme',
  'home.drag': 'Drag the glowing core. Hover a planet to open its quiz.',
  'foot.1': 'StudySprint is a free study tool. Use a nickname, never your real name, phone number or school. Be kind in chat.',
  'foot.a': 'Questions: built-in bank plus', 'foot.b': '(CC BY-SA 4.0).', 'foot.c': 'Papers:', 'foot.d': 'Books:',
  'foot.e': 'Headlines link to their publishers.',
  'pill.focus': 'Focus', 'pill.break': 'Break', 'pill.paused': 'paused',
  'common.retry': 'Try again', 'common.reload': 'Reload',
  'nf.title': 'Page not found', 'nf.body': 'That page does not exist.', 'nf.home': 'Go to home',

  'nav.tutor': 'AI Tutor',
  'tutor.title': 'Sprint, your AI tutor', 'tutor.sub': 'Ask a doubt in English, हिंदी or Hinglish. Sprint explains step by step, quizzes you and reviews your mistakes.',
  'tutor.ph': 'Ask a doubt…', 'tutor.send': 'Send', 'tutor.stop': 'Stop', 'tutor.clear': 'New chat', 'tutor.open': 'Open AI tutor', 'tutor.close': 'Close',
  'tutor.lang': 'Reply language', 'tutor.lang.auto': 'Auto', 'tutor.lang.en': 'English', 'tutor.lang.hi': 'हिंदी', 'tutor.lang.hinglish': 'Hinglish',
  'tutor.subject': 'Subject', 'tutor.subject.any': 'Any subject',
  'tutor.m.explain': 'Explain a topic', 'tutor.m.doubt': 'Solve a doubt', 'tutor.m.quiz': 'Quiz me', 'tutor.m.plan': 'Study plan', 'tutor.m.notes': 'Quick notes', 'tutor.m.mistakes': 'Review my mistakes',
  'tutor.p.explain': 'Explain this topic simply: ', 'tutor.p.doubt': 'Help me solve this doubt: ', 'tutor.p.notes': 'Give me quick revision notes on: ', 'tutor.p.plan': 'Make me a Pomodoro study plan for: ',
  'tutor.p.quiz': 'Quiz me on {s}. Start with the first question.', 'tutor.p.mistakes': 'Review my recent mistakes and tell me what to revise.',
  'tutor.f.simpler': 'Explain simpler', 'tutor.f.example': 'Give an example', 'tutor.f.quiz': 'Quiz me on this', 'tutor.f.more': 'Continue',
  'tutor.p.f.simpler': 'Please explain that again in simpler words.', 'tutor.p.f.example': 'Give me one more example.', 'tutor.p.f.quiz': 'Quiz me on this, one question at a time.', 'tutor.p.f.more': 'Please continue.',
  'tutor.hello': 'Hi! I am Sprint, your study buddy. Pick a mode below or just ask me anything.',
  'tutor.login': 'Log in to chat with the AI tutor. It is free.', 'tutor.off': 'The AI tutor is not switched on for this site yet.',
  'tutor.left': '{n} messages left today', 'tutor.note': 'Sprint is an AI and can make mistakes. Check important facts with your textbook or teacher.',
  'tutor.copy': 'Copy', 'tutor.copied': 'Copied', 'tutor.listen': 'Listen', 'tutor.listening': 'Stop listening', 'tutor.thinking': 'Sprint is thinking', 'tutor.cut': 'The reply was cut short.',
  'tutor.mic': 'Speak your question', 'tutor.mic.stop': 'Stop listening', 'tutor.mic.on': 'Listening… speak now',
  'tutor.mic.denied': 'The microphone is blocked. Allow it in your browser site settings and try again.', 'tutor.mic.none': 'I did not hear anything. Tap the mic and try again.',
  'tutor.mic.net': 'Voice typing needs an internet connection.', 'tutor.mic.nomic': 'No microphone was found on this device.', 'tutor.mic.fail': 'Voice typing did not work. You can type your question instead.',

  'timer.ready': 'Ready to focus', 'timer.focusing': 'Focusing on {s}', 'timer.long': 'Long break', 'timer.short': 'Short break',
  'timer.paused': 'paused', 'timer.start': 'Start {n} minute focus', 'timer.resume': 'Resume', 'timer.pause': 'Pause',
  'timer.stop': 'Stop', 'timer.skip': 'Skip break', 'timer.quizbreak': 'Quiz during break', 'timer.general': 'General study',
  'timer.confirm': 'Stop this session? Minutes will not be counted.', 'timer.subject': 'Subject for this session',
  'timer.done1': 'Completed today: {n} focus session. A long break comes after every {e}.',
  'timer.donen': 'Completed today: {n} focus sessions. A long break comes after every {e}.',

  'quiz.title': 'Timed quiz',
  'quiz.intro': 'Pick a subject. Each question has its own countdown, and faster correct answers earn more points (100 to 150). Points count towards the quiz leaderboard.',
  'quiz.subject': 'Subject', 'quiz.count': 'Questions', 'quiz.secs': 'Seconds per question', 'quiz.start': 'Start quiz', 'quiz.nq': '{n} questions',

  'home.eyebrow': 'Free, made for students across India', 'home.h1a': 'Focus. Quiz.', 'home.h1b': 'Compete.',
  'home.lede': 'A free study space for students across India. Run a Pomodoro, test yourself with timed questions, join a weekly subject contest and ask the whole country when you are stuck.',
  'home.cta1': 'Take a timed quiz', 'home.cta2': 'See contests', 'home.meta': '{n} questions across {s} subjects.', 'home.scroll': 'Scroll',

  'ch.focus.a': 'Twenty-five minutes.', 'ch.focus.b': 'Nothing else.',
  'ch.focus.p': 'The timer keeps running while you move between pages. Finished sessions are verified by the server, so every minute on the leaderboard is a minute somebody really studied.',
  'rule1.t': '25 minutes of focus', 'rule1.d': 'One subject, one session. Pick what you are studying before you start.',
  'rule2.t': '5 minutes of rest', 'rule2.d': 'A short break after every session. Skip it if you are on a roll.',
  'rule3.t': '15 minutes after four', 'rule3.d': 'Every fourth session earns a long break.',

  'ch.subj.a': '{n} subjects.', 'ch.subj.b': 'Pick a layer, dig in.',
  'ch.subj.p': 'Timed questions in every subject, with an explanation after each answer.',

  'ch.speed.a': 'Faster right answers', 'ch.speed.b': 'are worth more.',
  'ch.speed.p': 'Every correct answer earns 100 points. Answer quickly and you can earn up to 50 more.',
  'speed.f1': 'A wrong answer or a timeout earns nothing.',
  'speed.f2': 'The server owns the clock and the answer key, so scores cannot be faked from the browser.',
  'chart.cap': 'A 30-second question', 'chart.base': 'Base points', 'chart.bonus': 'Speed bonus',

  'ch.comp.a': 'A new contest', 'ch.comp.b': 'every week.',
  'ch.comp.p': 'Same questions for everyone, a waiting room before the start and a live leaderboard.',
  'comp.next': 'Next contests', 'comp.all': 'All contests', 'comp.top': 'Top this week', 'comp.full': 'Full leaderboard',
  'comp.none': 'No scores yet this week. Take a quiz to be first on the board.',
  'comp.err': 'Contests could not be loaded.', 'comp.errb': 'Leaderboard could not be loaded.',
  'comp.contest': '{s} contest', 'comp.starts': 'starts in {t}', 'comp.live': 'LIVE now', 'comp.closed': 'closed',

  'ch.news.a': 'Today in', 'ch.news.b': 'science and the world.',
  'topic.nobel': 'Nobel Prize', 'topic.science': 'Science', 'topic.current': 'Current affairs', 'topic.space': 'Space and tech',
  'news.fail': 'Live headlines could not be loaded right now. Read the latest directly from these official sources:',
  'news.stale': 'Showing earlier headlines. Live updates are temporarily unavailable.', 'news.src': 'Official sources',

  'num.title': 'The whole sprint in four numbers',
  'num.q': 'Questions', 'num.s': 'Subjects', 'num.m': 'Minutes per sprint', 'num.p': 'Max points per question',

  'end.eyebrow': 'Ready when you are', 'end.a': 'Start your', 'end.b': 'sprint.',
  'end.p': 'You can try the timer without an account. Log in to count focus minutes and quiz points on the leaderboards.',
  'end.cta1': 'Start focusing',

  'hud.sprint': 'Sprint',
  'stop.start': 'Start', 'stop.focus': 'Focus', 'stop.subjects': 'Subjects', 'stop.speed': 'Speed', 'stop.compete': 'Compete',
  'stop.news': 'News', 'stop.numbers': 'Numbers', 'stop.go': 'Go',
};

const HI = {
  'nav.home': 'होम', 'nav.focus': 'फ़ोकस', 'nav.quiz': 'क्विज़', 'nav.contests': 'प्रतियोगिताएँ', 'nav.leaderboard': 'लीडरबोर्ड',
  'nav.chat': 'लाइव चैट', 'nav.doubts': 'डाउट्स', 'nav.research': 'शोध', 'nav.books': 'किताबें',
  'auth.login': 'लॉग इन', 'auth.signup': 'साइन अप', 'auth.logout': 'लॉग आउट',
  'lang.switch': 'भाषा बदलें', 'skip': 'सामग्री पर जाएँ', 'theme.switch': 'रंग थीम बदलें',
  'home.drag': 'चमकते कोर को घुमाइए। किसी ग्रह पर कर्सर ले जाइए और उसकी क्विज़ खोलिए।',
  'foot.1': 'StudySprint एक मुफ़्त स्टडी टूल है। निकनेम का उपयोग करें, अपना असली नाम, फ़ोन नंबर या स्कूल कभी न लिखें। चैट में विनम्र रहें।',
  'foot.a': 'प्रश्न: बिल्ट-इन बैंक तथा', 'foot.b': '(CC BY-SA 4.0)।', 'foot.c': 'शोध-पत्र:', 'foot.d': 'किताबें:',
  'foot.e': 'समाचार शीर्षक उनके प्रकाशकों से जुड़ते हैं।',
  'pill.focus': 'फ़ोकस', 'pill.break': 'ब्रेक', 'pill.paused': 'रुका हुआ',
  'common.retry': 'फिर कोशिश करें', 'common.reload': 'रीलोड करें',
  'nf.title': 'पेज नहीं मिला', 'nf.body': 'यह पेज मौजूद नहीं है।', 'nf.home': 'होम पर जाएँ',

  'nav.tutor': 'AI ट्यूटर',
  'tutor.title': 'स्प्रिंट, आपका AI ट्यूटर', 'tutor.sub': 'अपना डाउट हिंदी, English या Hinglish में पूछिए। स्प्रिंट कदम-दर-कदम समझाता है, क्विज़ लेता है और आपकी गलतियाँ देखता है।',
  'tutor.ph': 'अपना डाउट पूछिए…', 'tutor.send': 'भेजें', 'tutor.stop': 'रोकें', 'tutor.clear': 'नई चैट', 'tutor.open': 'AI ट्यूटर खोलें', 'tutor.close': 'बंद करें',
  'tutor.lang': 'जवाब की भाषा', 'tutor.lang.auto': 'अपने-आप', 'tutor.lang.en': 'English', 'tutor.lang.hi': 'हिंदी', 'tutor.lang.hinglish': 'Hinglish',
  'tutor.subject': 'विषय', 'tutor.subject.any': 'कोई भी विषय',
  'tutor.m.explain': 'टॉपिक समझाओ', 'tutor.m.doubt': 'डाउट सुलझाओ', 'tutor.m.quiz': 'मेरा क्विज़ लो', 'tutor.m.plan': 'स्टडी प्लान', 'tutor.m.notes': 'झटपट नोट्स', 'tutor.m.mistakes': 'मेरी गलतियाँ देखो',
  'tutor.p.explain': 'इस टॉपिक को आसान भाषा में समझाइए: ', 'tutor.p.doubt': 'इस डाउट को सुलझाने में मदद कीजिए: ', 'tutor.p.notes': 'इसके छोटे रिवीज़न नोट्स दीजिए: ', 'tutor.p.plan': 'इसके लिए पोमोडोरो स्टडी प्लान बनाइए: ',
  'tutor.p.quiz': '{s} में मेरा क्विज़ लीजिए। पहला प्रश्न पूछिए।', 'tutor.p.mistakes': 'मेरी हाल की गलतियाँ देखिए और बताइए कि क्या दोहराना चाहिए।',
  'tutor.f.simpler': 'और आसान समझाओ', 'tutor.f.example': 'उदाहरण दो', 'tutor.f.quiz': 'इस पर क्विज़ लो', 'tutor.f.more': 'आगे बताओ',
  'tutor.p.f.simpler': 'कृपया इसे और आसान शब्दों में समझाइए।', 'tutor.p.f.example': 'एक और उदाहरण दीजिए।', 'tutor.p.f.quiz': 'इस पर मेरा क्विज़ लीजिए, एक बार में एक प्रश्न।', 'tutor.p.f.more': 'कृपया आगे बताइए।',
  'tutor.hello': 'नमस्ते! मैं स्प्रिंट हूँ, आपका पढ़ाई का साथी। नीचे से कोई मोड चुनिए या सीधे कुछ भी पूछिए।',
  'tutor.login': 'AI ट्यूटर से बात करने के लिए लॉग इन करें। यह मुफ़्त है।', 'tutor.off': 'इस साइट पर AI ट्यूटर अभी चालू नहीं है।',
  'tutor.left': 'आज {n} संदेश बाकी', 'tutor.note': 'स्प्रिंट एक AI है और गलती कर सकता है। ज़रूरी बातें अपनी किताब या शिक्षक से जाँच लीजिए।',
  'tutor.copy': 'कॉपी', 'tutor.copied': 'कॉपी हुआ', 'tutor.listen': 'सुनें', 'tutor.listening': 'सुनना रोकें', 'tutor.thinking': 'स्प्रिंट सोच रहा है', 'tutor.cut': 'जवाब बीच में कट गया।',
  'tutor.mic': 'बोलकर पूछिए', 'tutor.mic.stop': 'सुनना रोकें', 'tutor.mic.on': 'सुन रहा हूँ… अब बोलिए',
  'tutor.mic.denied': 'माइक्रोफ़ोन बंद है। अपने ब्राउज़र की साइट सेटिंग में उसे अनुमति दीजिए और दोबारा कोशिश कीजिए।', 'tutor.mic.none': 'कुछ सुनाई नहीं दिया। माइक दबाकर दोबारा बोलिए।',
  'tutor.mic.net': 'वॉइस टाइपिंग के लिए इंटरनेट चाहिए।', 'tutor.mic.nomic': 'इस डिवाइस में माइक्रोफ़ोन नहीं मिला।', 'tutor.mic.fail': 'वॉइस टाइपिंग नहीं चली। आप अपना प्रश्न टाइप कर सकते हैं।',

  'timer.ready': 'फ़ोकस के लिए तैयार', 'timer.focusing': '{s} पर फ़ोकस', 'timer.long': 'लंबा ब्रेक', 'timer.short': 'छोटा ब्रेक',
  'timer.paused': 'रुका हुआ', 'timer.start': '{n} मिनट का फ़ोकस शुरू करें', 'timer.resume': 'फिर शुरू करें', 'timer.pause': 'रोकें',
  'timer.stop': 'बंद करें', 'timer.skip': 'ब्रेक छोड़ें', 'timer.quizbreak': 'ब्रेक में क्विज़', 'timer.general': 'सामान्य अध्ययन',
  'timer.confirm': 'यह सेशन बंद करें? मिनट गिने नहीं जाएँगे।', 'timer.subject': 'इस सेशन का विषय',
  'timer.done1': 'आज पूरा हुआ: {n} फ़ोकस सेशन। हर {e} सेशन के बाद लंबा ब्रेक मिलता है।',
  'timer.donen': 'आज पूरे हुए: {n} फ़ोकस सेशन। हर {e} सेशन के बाद लंबा ब्रेक मिलता है।',

  'quiz.title': 'समयबद्ध क्विज़',
  'quiz.intro': 'एक विषय चुनिए। हर प्रश्न का अपना काउंटडाउन है, और जल्दी दिए सही उत्तर पर ज़्यादा अंक मिलते हैं (100 से 150)। अंक क्विज़ लीडरबोर्ड में गिने जाते हैं।',
  'quiz.subject': 'विषय', 'quiz.count': 'प्रश्न', 'quiz.secs': 'प्रति प्रश्न सेकंड', 'quiz.start': 'क्विज़ शुरू करें', 'quiz.nq': '{n} प्रश्न',

  'home.eyebrow': 'मुफ़्त, पूरे भारत के विद्यार्थियों के लिए', 'home.h1a': 'फ़ोकस। क्विज़।', 'home.h1b': 'मुक़ाबला।',
  'home.lede': 'पूरे भारत के विद्यार्थियों के लिए एक मुफ़्त स्टडी स्पेस। पोमोडोरो चलाइए, समयबद्ध प्रश्नों से खुद को परखिए, साप्ताहिक विषय प्रतियोगिता में भाग लीजिए और अटकने पर पूरे देश से पूछिए।',
  'home.cta1': 'समयबद्ध क्विज़ खेलें', 'home.cta2': 'प्रतियोगिताएँ देखें', 'home.meta': '{s} विषयों में {n} प्रश्न।', 'home.scroll': 'नीचे जाएँ',

  'ch.focus.a': 'पच्चीस मिनट।', 'ch.focus.b': 'और कुछ नहीं।',
  'ch.focus.p': 'पेज बदलने पर भी टाइमर चलता रहता है। पूरे हुए सेशन की पुष्टि सर्वर करता है, इसलिए लीडरबोर्ड का हर मिनट सच में पढ़ाई का मिनट है।',
  'rule1.t': '25 मिनट फ़ोकस', 'rule1.d': 'एक विषय, एक सेशन। शुरू करने से पहले चुनिए कि क्या पढ़ रहे हैं।',
  'rule2.t': '5 मिनट आराम', 'rule2.d': 'हर सेशन के बाद छोटा ब्रेक। लय में हों तो इसे छोड़ दीजिए।',
  'rule3.t': 'चार के बाद 15 मिनट', 'rule3.d': 'हर चौथे सेशन के बाद लंबा ब्रेक मिलता है।',

  'ch.subj.a': '{n} विषय।', 'ch.subj.b': 'एक परत चुनिए, गहराई में उतरिए।',
  'ch.subj.p': 'हर विषय में समयबद्ध प्रश्न, और हर उत्तर के बाद व्याख्या।',

  'ch.speed.a': 'जल्दी दिए सही उत्तर', 'ch.speed.b': 'के अंक ज़्यादा।',
  'ch.speed.p': 'हर सही उत्तर के 100 अंक मिलते हैं। जल्दी जवाब दें तो 50 अंक तक और मिल सकते हैं।',
  'speed.f1': 'गलत उत्तर या समय खत्म होने पर कोई अंक नहीं मिलता।',
  'speed.f2': 'घड़ी और उत्तर-कुंजी सर्वर के पास रहती है, इसलिए ब्राउज़र से स्कोर में हेरफेर नहीं हो सकता।',
  'chart.cap': '30 सेकंड का एक प्रश्न', 'chart.base': 'मूल अंक', 'chart.bonus': 'स्पीड बोनस',

  'ch.comp.a': 'हर हफ़्ते', 'ch.comp.b': 'एक नई प्रतियोगिता।',
  'ch.comp.p': 'सबके लिए एक जैसे प्रश्न, शुरू होने से पहले वेटिंग रूम और लाइव लीडरबोर्ड।',
  'comp.next': 'अगली प्रतियोगिताएँ', 'comp.all': 'सभी प्रतियोगिताएँ', 'comp.top': 'इस हफ़्ते के शीर्ष', 'comp.full': 'पूरा लीडरबोर्ड',
  'comp.none': 'इस हफ़्ते अभी कोई स्कोर नहीं है। क्विज़ खेलकर बोर्ड पर पहले बनिए।',
  'comp.err': 'प्रतियोगिताएँ लोड नहीं हो सकीं।', 'comp.errb': 'लीडरबोर्ड लोड नहीं हो सका।',
  'comp.contest': '{s} प्रतियोगिता', 'comp.starts': '{t} में शुरू', 'comp.live': 'अभी लाइव', 'comp.closed': 'समाप्त',

  'ch.news.a': 'आज', 'ch.news.b': 'विज्ञान और दुनिया में।',
  'topic.nobel': 'नोबेल पुरस्कार', 'topic.science': 'विज्ञान', 'topic.current': 'समसामयिकी', 'topic.space': 'अंतरिक्ष और तकनीक',
  'news.fail': 'लाइव समाचार अभी लोड नहीं हो सके। ताज़ा खबरें सीधे इन आधिकारिक स्रोतों पर पढ़ें:',
  'news.stale': 'पुराने शीर्षक दिखाए जा रहे हैं। लाइव अपडेट अभी उपलब्ध नहीं हैं।', 'news.src': 'आधिकारिक स्रोत',

  'num.title': 'पूरी स्प्रिंट, चार आँकड़ों में',
  'num.q': 'प्रश्न', 'num.s': 'विषय', 'num.m': 'मिनट प्रति स्प्रिंट', 'num.p': 'अधिकतम अंक प्रति प्रश्न',

  'end.eyebrow': 'जब आप तैयार हों', 'end.a': 'अपनी', 'end.b': 'स्प्रिंट शुरू कीजिए।',
  'end.p': 'टाइमर बिना अकाउंट के भी आज़मा सकते हैं। फ़ोकस मिनट और क्विज़ अंक लीडरबोर्ड पर गिनवाने के लिए लॉग इन करें।',
  'end.cta1': 'फ़ोकस शुरू करें',

  'hud.sprint': 'स्प्रिंट',
  'stop.start': 'शुरुआत', 'stop.focus': 'फ़ोकस', 'stop.subjects': 'विषय', 'stop.speed': 'गति', 'stop.compete': 'प्रतियोगिता',
  'stop.news': 'समाचार', 'stop.numbers': 'आँकड़े', 'stop.go': 'चलो',

  // subject names and blurbs (the server sends English ones; these replace them in Hindi)
  'subj.physics': 'भौतिकी', 'subj.chemistry': 'रसायन विज्ञान', 'subj.biology': 'जीव विज्ञान', 'subj.math': 'गणित',
  'subj.cs': 'कंप्यूटर विज्ञान', 'subj.history': 'इतिहास', 'subj.geography': 'भूगोल', 'subj.polity': 'भारतीय राजव्यवस्था',
  'blurb.physics': 'गति, प्रकाश, विद्युत', 'blurb.chemistry': 'परमाणु, बंधन, अभिक्रियाएँ', 'blurb.biology': 'कोशिकाएँ, जीन, मानव शरीर',
  'blurb.math': 'बीजगणित, कलन, ज्यामिति', 'blurb.cs': 'कोड, डेटा, कंप्यूटर', 'blurb.history': 'भारत और विश्व',
  'blurb.geography': 'भूमि, नदियाँ, जलवायु', 'blurb.polity': 'संविधान और शासन',
};

const D = { en: EN, hi: HI };
let lang = 'en';
try {
  const saved = localStorage.getItem(KEY);
  if (saved === 'en' || saved === 'hi') lang = saved;
  else if ((navigator.language || '').toLowerCase().startsWith('hi')) lang = 'hi';
} catch { /* storage blocked: stay on English */ }
document.documentElement.lang = lang;

export const getLang = () => lang;

export function t(key, vars) {
  let s = D[lang][key] ?? EN[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

/** Subject name / blurb as shown to the student (server data is English; Hindi comes from the dictionary). */
export const subjName = (s) => (lang === 'hi' && HI['subj.' + s.id]) || s.name;
export const subjBlurb = (s) => (lang === 'hi' && HI['blurb.' + s.id]) || s.blurb;

/** Fill every [data-i18n] element (and [data-i18n-label] aria-labels) inside root. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
}

export function setLang(next) {
  if (next === lang || !D[next]) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  document.documentElement.lang = next;
  applyI18n();
  window.dispatchEvent(new CustomEvent('langchange', { detail: next }));
}
