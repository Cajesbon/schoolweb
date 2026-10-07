'use strict';
/*
 * Default website content. Everything here is placeholder copy that the
 * administrator replaces from the dashboard. The SHAPE of this object is
 * also the schema: the server only accepts keys that exist here.
 */
module.exports = {
  school: {
    name: 'Bright Horizons Primary School',
    tagline: 'Nurturing curious minds. Building confident futures.',
    description:
      'A caring, high-achieving primary school where every child is known by name, challenged to do their best and encouraged to be kind.',
    logo: '',
    favicon: '',
    websiteTitle: 'Bright Horizons Primary School | Early Years & Primary Education',
    principalName: 'Mrs. Eleanor Whitfield',
    principalTitle: 'Headteacher',
  },

  home: {
    hero: {
      headline: 'A place where every child is known, challenged and celebrated.',
      description:
        'From Nursery to Primary, we pair rigorous teaching with real warmth, so children grow in knowledge, character and confidence.',
      image: '',
      ctaText: 'Apply for admission',
      ctaLink: '/admissions#apply',
      secondaryCtaText: 'Plan a school visit',
      secondaryCtaLink: '/contact',
    },
    announcements: { enabled: true, title: 'Notices and announcements' },
    welcome: {
      enabled: true,
      title: 'A warm welcome to our school',
      message:
        'Choosing a first school is one of the most important decisions a family makes. Here, small classes and dedicated teachers mean your child is always seen, heard and encouraged.\n\nWe work closely with parents so that home and school pull in the same direction: toward a happy, curious child who loves to learn.',
      image: '',
    },
    whyChooseUs: {
      enabled: true,
      title: 'Why families choose us',
      subtitle: 'Six reasons parents trust us with their children’s early years.',
      items: [
        { title: 'Qualified, caring teachers', text: 'Our teachers are trained, experienced and genuinely invested in every child’s progress.', icon: 'users' },
        { title: 'Small class sizes', text: 'More time with the teacher means more feedback, more confidence and fewer children left behind.', icon: 'heart' },
        { title: 'A safe, secure campus', text: 'Controlled access, trained staff and clear safeguarding routines keep children protected.', icon: 'shield' },
        { title: 'Strong foundations', text: 'A structured programme in reading, writing and number builds skills that last.', icon: 'book' },
        { title: 'Technology with purpose', text: 'Age-appropriate digital skills taught in our ICT room, always guided by a teacher.', icon: 'laptop' },
        { title: 'Character and values', text: 'Respect, honesty and kindness are taught and practised every day.', icon: 'star' },
      ],
    },
    programmes: {
      enabled: true,
      title: 'Our academic programmes',
      subtitle: 'A clear pathway from a child’s first classroom to the end of primary school.',
      items: [
        { title: 'Early Years', text: 'Play-based learning that develops language, movement, curiosity and social confidence.', image: '' },
        { title: 'Nursery', text: 'Phonics, early number work and creative play prepare children for formal schooling.', image: '' },
        { title: 'Primary', text: 'A broad curriculum with strong literacy, numeracy, science and creative learning.', image: '' },
      ],
    },
    facilities: {
      enabled: true,
      title: 'Facilities built for learning',
      subtitle: 'Bright, safe spaces designed around how children learn best.',
      items: [
        { title: 'Library', text: 'A quiet, well-stocked reading space that helps children fall in love with books.', image: '' },
        { title: 'ICT room', text: 'Modern computers for supervised, age-appropriate digital learning.', image: '' },
        { title: 'Science corner', text: 'Hands-on experiments that turn questions into discoveries.', image: '' },
        { title: 'Playground', text: 'Safe, shaded play areas for exercise, friendship and fun.', image: '' },
      ],
    },
    activities: {
      enabled: true,
      title: 'Beyond the classroom',
      subtitle: 'Activities that help children find what they love.',
      items: [
        { title: 'Sports and games', text: 'Football, athletics, swimming games and an annual sports day.' },
        { title: 'Music and drama', text: 'Choir, instruments and school productions that build stage confidence.' },
        { title: 'Art and craft', text: 'Drawing, painting and making, with work displayed around the school.' },
        { title: 'Clubs and societies', text: 'Reading, chess, science and environmental clubs after lessons.' },
        { title: 'Excursions', text: 'Class trips that bring lessons to life outside the school gate.' },
      ],
    },
    values: {
      enabled: true,
      title: 'The values we teach',
      items: [
        { title: 'Integrity', text: 'Doing the right thing, even when no one is watching.' },
        { title: 'Respect', text: 'Listening to others and valuing every voice.' },
        { title: 'Curiosity', text: 'Asking questions and wanting to know more.' },
        { title: 'Responsibility', text: 'Owning our choices and caring for our school.' },
        { title: 'Kindness', text: 'Looking out for one another, always.' },
      ],
    },
    gallery: {
      enabled: true,
      title: 'Life at our school',
      subtitle: 'A glimpse of everyday moments, celebrations and achievements.',
    },
    testimonials: {
      enabled: true,
      title: 'What parents say',
      items: [
        { name: 'Sample parent', role: 'Parent of a Primary 3 pupil', quote: 'My daughter runs to class every morning. The teachers know her strengths and gently push her where she needs it.' },
        { name: 'Sample parent', role: 'Parent of a Nursery pupil', quote: 'The communication is excellent. We always know how our son is doing and what he is learning.' },
        { name: 'Sample parent', role: 'Parent of two pupils', quote: 'A safe, friendly school with high standards. Both of our children have grown in confidence.' },
      ],
    },
    admissionCta: {
      enabled: true,
      title: 'Admissions are now open',
      text: 'Give your child a strong start. Applying takes only a few minutes online, and our team is happy to guide you through every step.',
      buttonText: 'Start your application',
    },
    contactCta: {
      enabled: true,
      title: 'Come and see the school for yourself',
      text: 'We would love to show you around, introduce you to our teachers and answer your questions.',
      buttonText: 'Contact the school',
    },
  },

  about: {
    bannerImage: '',
    intro: {
      title: 'About our school',
      text: 'We are a primary school built on a simple belief: children learn best when they feel safe, known and encouraged.\n\nOur teachers combine a rigorous curriculum with warmth and high expectations, and our families are partners in everything we do.',
      image: '',
    },
    overview: {
      title: 'The school at a glance',
      stats: [
        { value: '25+', label: 'Years serving families' },
        { value: '15:1', label: 'Pupils per teacher' },
        { value: '400', label: 'Pupils on roll' },
        { value: '30', label: 'Qualified staff' },
      ],
    },
    history: {
      title: 'Our history',
      text: 'The school opened with a handful of classrooms and a clear purpose: to give local children an excellent start in life.\n\nOver the years we have grown carefully, adding classrooms, a library, an ICT room and sports facilities, without losing the close-knit feel that families value.',
      image: '',
    },
    mission: {
      title: 'Our mission',
      text: 'To provide a safe, stimulating and caring environment where every child achieves academically and grows in character.',
    },
    vision: {
      title: 'Our vision',
      text: 'Confident, curious and compassionate young people who are ready to thrive in the next stage of their education and in life.',
    },
    values: {
      title: 'Our core values',
      items: [
        { title: 'Integrity', text: 'We are honest and fair in all that we do.' },
        { title: 'Respect', text: 'We treat everyone with courtesy and dignity.' },
        { title: 'Excellence', text: 'We aim high and support each child to reach their potential.' },
        { title: 'Care', text: 'We look after each other and our community.' },
      ],
    },
    principal: {
      title: 'A message from the Headteacher',
      message:
        'Welcome to our school. Every child who joins us arrives with their own talents, questions and personality, and it is our privilege to help them flourish.\n\nWe set high expectations, celebrate effort and keep parents closely involved. I invite you to visit, meet our team and see our children at work.',
      image: '',
    },
    philosophy: {
      title: 'Our teaching philosophy',
      text: 'We believe in learning through doing. Lessons are structured and purposeful, but also practical and enjoyable.\n\nWe check understanding often, give clear feedback and adapt our teaching so that every child is challenged and supported.',
      image: '',
    },
  },

  academics: {
    bannerImage: '',
    intro: {
      title: 'Learning that builds strong foundations',
      text: 'Our curriculum is carefully sequenced from the first day of Early Years to the end of Primary, so each year builds confidently on the last.',
    },
    levels: [
      { title: 'Early Years', ages: 'Ages 2 to 3', text: 'Gentle, play-based learning develops language, movement and social skills in a nurturing setting.', image: '' },
      { title: 'Nursery', ages: 'Ages 3 to 5', text: 'Children begin phonics, early number work and creative play, preparing them for the move to formal schooling.', image: '' },
      { title: 'Primary', ages: 'Ages 5 to 11', text: 'A broad, balanced curriculum with a strong focus on literacy and numeracy, supported by science, technology and the arts.', image: '' },
    ],
    subjects: {
      title: 'What children learn',
      intro: 'A balanced curriculum that develops the whole child.',
      items: [
        { title: 'Literacy', text: 'Phonics, reading, writing and speaking, with a love of books at the centre.', icon: 'book' },
        { title: 'Numeracy', text: 'Number sense, problem solving and mental maths taught step by step.', icon: 'calculator' },
        { title: 'Science', text: 'Hands-on investigation that builds curiosity and careful thinking.', icon: 'flask' },
        { title: 'Technology', text: 'Safe, practical digital skills that grow with the child.', icon: 'laptop' },
        { title: 'Creative arts', text: 'Art, music and drama that nurture imagination and self-expression.', icon: 'palette' },
        { title: 'Physical education', text: 'Games, athletics and movement for healthy bodies and team spirit.', icon: 'activity' },
        { title: 'Social and moral development', text: 'Lessons in kindness, honesty, respect and responsibility.', icon: 'heart' },
      ],
    },
  },

  facilities: {
    bannerImage: '',
    intro: {
      title: 'Spaces where children thrive',
      text: 'Every part of our campus is designed to be safe, welcoming and useful for learning.',
    },
    items: [
      { title: 'Classrooms', text: 'Bright, well-ventilated rooms with child-sized furniture and displays of pupils’ work.', image: '', icon: 'building' },
      { title: 'Library', text: 'A calm reading space with books for every age and reading level.', image: '', icon: 'book' },
      { title: 'ICT and computer room', text: 'Modern computers for supervised lessons in digital skills.', image: '', icon: 'laptop' },
      { title: 'Science facilities', text: 'Equipment for simple, safe experiments that bring ideas to life.', image: '', icon: 'flask' },
      { title: 'Playground', text: 'Secure outdoor play areas where children run, climb and make friends.', image: '', icon: 'sun' },
      { title: 'Sports facilities', text: 'Space and equipment for games, athletics and our annual sports day.', image: '', icon: 'trophy' },
      { title: 'Dining area', text: 'A clean, supervised space for healthy meals and snacks.', image: '', icon: 'utensils' },
      { title: 'Security', text: 'Controlled entry, visitor checks and trained staff on duty throughout the day.', image: '', icon: 'shield' },
      { title: 'First aid and health care', text: 'A first-aid room and trained staff to care for minor illness and injury.', image: '', icon: 'cross' },
      { title: 'School transportation', text: 'Safe, supervised school buses on set routes.', image: '', icon: 'bus' },
    ],
  },

  gallery: {
    bannerImage: '',
    intro: 'Moments from classrooms, playgrounds, stage performances and school trips.',
    categories: ['School', 'Classrooms', 'Students', 'Sports', 'Events', 'Cultural Activities', 'Excursions', 'Graduation'],
  },

  admissions: {
    enabled: true,
    bannerImage: '',
    intro: {
      title: 'Join our school community',
      text: 'We welcome applications from families who want a caring school with high expectations. The steps below explain how admission works.',
    },
    process: [
      { title: 'Submit the online form', text: 'Complete the application form below with your child’s details.' },
      { title: 'We contact you', text: 'The admissions office will reach out to confirm receipt and arrange a visit.' },
      { title: 'Visit and meet the team', text: 'Tour the school, meet teachers and ask any questions.' },
      { title: 'Assessment and offer', text: 'Your child takes a short, friendly assessment, and we confirm the outcome.' },
    ],
    classes: ['Early Years', 'Nursery 1', 'Nursery 2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
    requirements: [
      'Completed application form',
      'Copy of the child’s birth certificate',
      'Recent passport photographs',
      'Previous school report (where applicable)',
      'Immunisation or health record',
    ],
    instructions:
      'Please fill in every required field accurately. Use a phone number and email address that you check regularly, as we will use them to reach you.',
    importantInfo:
      'Submitting an application does not guarantee a place. Offers depend on available space and the outcome of the assessment. Fees and term dates are shared by the admissions office.',
    faqs: [
      { q: 'When can my child start?', a: 'Children can join at the start of any term, subject to space in the class.' },
      { q: 'Is there an entrance assessment?', a: 'Yes. It is a short, relaxed session designed to understand where your child is, not to catch them out.' },
      { q: 'Can I visit the school first?', a: 'Of course. Contact us to arrange a tour at a time that suits you.' },
      { q: 'What does school transport cover?', a: 'We run supervised buses on set routes. Ask the admissions office whether your area is covered.' },
      { q: 'How will I hear back?', a: 'We contact every applicant by phone or email, usually within a few working days.' },
    ],
    formTitle: 'Online application form',
    successMessage:
      'Thank you. Your application has been received and the admissions office will contact you shortly.',
    closedMessage:
      'Online applications are currently closed. Please contact the school office for more information.',
    fields: [
      { key: 'child_name', label: 'Child’s full name', type: 'text', required: true, options: [] },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date', required: true, options: [] },
      { key: 'gender', label: 'Gender', type: 'select', required: true, options: ['Female', 'Male'] },
      { key: 'class_applying_for', label: 'Class applying for', type: 'class', required: true, options: [] },
      { key: 'previous_school', label: 'Previous school (if any)', type: 'text', required: false, options: [] },
      { key: 'parent_name', label: 'Parent or guardian’s full name', type: 'text', required: true, options: [] },
      { key: 'phone', label: 'Phone number', type: 'tel', required: true, options: [] },
      { key: 'email', label: 'Email address', type: 'email', required: true, options: [] },
      { key: 'address', label: 'Home address', type: 'textarea', required: false, options: [] },
      { key: 'notes', label: 'Anything else we should know?', type: 'textarea', required: false, options: [] },
    ],
  },

  contact: {
    bannerImage: '',
    intro: 'We are happy to answer your questions and arrange a visit. Reach us by phone, WhatsApp, email or the form below.',
    address: '12 School Lane, Your City',
    phone: '',
    email: '',
    emergencyContact: '',
    openingHours: 'Monday to Friday: 7:30 am – 4:00 pm\nSaturday and Sunday: Closed',
    mapQuery: '',
    recipientEmail: '',
  },

  whatsapp: {
    enabled: true,
    number: '',
    defaultMessage: 'Hello, I would like to learn more about your school.',
    messages: {
      header: '',
      hero: '',
      admission: 'Hello, I would like to enquire about admission.',
      visit: 'Hello, I would like to schedule a school visit.',
      contact: '',
      footer: '',
      floating: '',
    },
    placements: { header: true, hero: true, admission: true, contact: true, footer: true, floating: true },
  },

  social: { facebook: '', instagram: '', tiktok: '', youtube: '', linkedin: '', twitter: '' },

  appearance: {
    preset: 'navy-gold',
    primary: '#0B2545',
    secondary: '#E6F0FA',
    accent: '#C9A24B',
    text: '#1B2433',
    background: '#FFFFFF',
  },
};
