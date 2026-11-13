const { randomBytes } = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const initialDemoShops = [
  {
    firstName: 'Aarav',
    lastName: 'Sharma',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    postalCode: '560025',
    countryCode: '+91',
    mobileNumber: '9000000001',
    address: '14 Residency Road',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    firstName: 'Priya',
    lastName: 'Nair',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '400050',
    countryCode: '+91',
    mobileNumber: '9000000002',
    address: '27 Linking Road',
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    firstName: 'Rohan',
    lastName: 'Mehta',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    postalCode: '110001',
    countryCode: '+91',
    mobileNumber: '9000000003',
    address: '8 Connaught Place',
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    firstName: 'Ananya',
    lastName: 'Iyer',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    postalCode: '500034',
    countryCode: '+91',
    mobileNumber: '9000000004',
    address: '22 Road No. 12',
    latitude: 17.385,
    longitude: 78.4867,
  },
  {
    firstName: 'Vikram',
    lastName: 'Reddy',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '600002',
    countryCode: '+91',
    mobileNumber: '9000000005',
    address: '5 Anna Salai',
    latitude: 13.0827,
    longitude: 80.2707,
  },
  {
    firstName: 'Neha',
    lastName: 'Kulkarni',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '411004',
    countryCode: '+91',
    mobileNumber: '9000000006',
    address: '18 Fergusson College Road',
    latitude: 18.5204,
    longitude: 73.8567,
  },
  {
    firstName: 'Arjun',
    lastName: 'Sen',
    city: 'Kolkata',
    state: 'West Bengal',
    country: 'India',
    postalCode: '700016',
    countryCode: '+91',
    mobileNumber: '9000000007',
    address: '31 Park Street',
    latitude: 22.5726,
    longitude: 88.3639,
  },
  {
    firstName: 'Olivia',
    lastName: 'Carter',
    city: 'New York',
    state: 'New York',
    country: 'United States',
    postalCode: '10013',
    countryCode: '+1',
    mobileNumber: '2125550101',
    address: '415 Broadway',
    latitude: 40.7128,
    longitude: -74.006,
  },
  {
    firstName: 'Ethan',
    lastName: 'Brooks',
    city: 'Los Angeles',
    state: 'California',
    country: 'United States',
    postalCode: '90015',
    countryCode: '+1',
    mobileNumber: '2135550102',
    address: '800 South Figueroa Street',
    latitude: 34.0522,
    longitude: -118.2437,
  },
  {
    firstName: 'Maya',
    lastName: 'Patel',
    city: 'Chicago',
    state: 'Illinois',
    country: 'United States',
    postalCode: '60601',
    countryCode: '+1',
    mobileNumber: '3125550103',
    address: '200 North Michigan Avenue',
    latitude: 41.8781,
    longitude: -87.6298,
  },
].map((shop, index) => ({
  ...shop,
  email: `demo.shop${String(index + 1).padStart(2, '0')}@example.test`,
  shopName: `${shop.firstName} ${shop.lastName} Device Repair`,
}));

const indiaOwners = [
  ['Aditya', 'Rao'],
  ['Aditi', 'Menon'],
  ['Akash', 'Verma'],
  ['Alia', 'Kapoor'],
  ['Aman', 'Bhat'],
  ['Amrita', 'Das'],
  ['Anil', 'Joshi'],
  ['Anita', 'Pillai'],
  ['Anuj', 'Naidu'],
  ['Arpita', 'Roy'],
  ['Ashwin', 'Nair'],
  ['Avani', 'Shah'],
  ['Bhavesh', 'Patel'],
  ['Charu', 'Gupta'],
  ['Deepak', 'Reddy'],
  ['Devika', 'Iyer'],
  ['Divya', 'Mehta'],
  ['Gaurav', 'Kulkarni'],
  ['Harish', 'Shetty'],
  ['Ishita', 'Banerjee'],
  ['Jatin', 'Sethi'],
  ['Kavya', 'Rao'],
  ['Kiran', 'Chawla'],
  ['Lakshmi', 'Krishnan'],
  ['Madhav', 'Desai'],
  ['Manish', 'Mukherjee'],
  ['Meera', 'Menon'],
  ['Mohan', 'Yadav'],
  ['Nandini', 'Sinha'],
  ['Naveen', 'Kumar'],
  ['Nikhil', 'Soni'],
  ['Nisha', 'Ghosh'],
  ['Pooja', 'Malhotra'],
  ['Pranav', 'Bansal'],
  ['Rahul', 'Mishra'],
  ['Rakesh', 'Tripathi'],
  ['Ritu', 'Agarwal'],
  ['Sanjay', 'Puri'],
  ['Shreya', 'Kaur'],
  ['Siddharth', 'Dubey'],
  ['Suman', 'Thomas'],
  ['Tanvi', 'Jha'],
  ['Tarun', 'Bhattacharya'],
  ['Usha', 'Menon'],
  ['Varun', 'Chandra'],
  ['Vijay', 'Rao'],
  ['Yash', 'Jain'],
  ['Zoya', 'Khan'],
  ['Ananya', 'Deshpande'],
  ['Bharat', 'Singh'],
  ['Chaitanya', 'Pawar'],
  ['Dinesh', 'Babu'],
  ['Esha', 'Mehra'],
  ['Farhan', 'Qureshi'],
  ['Geeta', 'Subramanian'],
  ['Hemant', 'Thakur'],
  ['Indira', 'Patil'],
  ['Jayant', 'Gokhale'],
  ['Karthik', 'Pillai'],
  ['Leela', 'Ranganathan'],
];

const indiaLocations = [
  ['Ahmedabad', 'Gujarat', '380001', 23.0225, 72.5714],
  ['Surat', 'Gujarat', '395003', 21.1702, 72.8311],
  ['Vadodara', 'Gujarat', '390001', 22.3072, 73.1812],
  ['Rajkot', 'Gujarat', '360001', 22.3039, 70.8022],
  ['Jaipur', 'Rajasthan', '302001', 26.9124, 75.7873],
  ['Jodhpur', 'Rajasthan', '342001', 26.2389, 73.0243],
  ['Udaipur', 'Rajasthan', '313001', 24.5854, 73.7125],
  ['Kota', 'Rajasthan', '324001', 25.2138, 75.8648],
  ['Lucknow', 'Uttar Pradesh', '226001', 26.8467, 80.9462],
  ['Kanpur', 'Uttar Pradesh', '208001', 26.4499, 80.3319],
  ['Varanasi', 'Uttar Pradesh', '221001', 25.3176, 82.9739],
  ['Agra', 'Uttar Pradesh', '282001', 27.1767, 78.0081],
  ['Prayagraj', 'Uttar Pradesh', '211001', 25.4358, 81.8463],
  ['Dehradun', 'Uttarakhand', '248001', 30.3165, 78.0322],
  ['Haridwar', 'Uttarakhand', '249401', 29.9457, 78.1642],
  ['Shimla', 'Himachal Pradesh', '171001', 31.1048, 77.1734],
  ['Jammu', 'Jammu and Kashmir', '180001', 32.7266, 74.857],
  ['Srinagar', 'Jammu and Kashmir', '190001', 34.0837, 74.7973],
  ['Ludhiana', 'Punjab', '141001', 30.901, 75.8573],
  ['Chandigarh', 'Chandigarh', '160017', 30.7333, 76.7794],
  ['Amritsar', 'Punjab', '143001', 31.634, 74.8723],
  ['Panaji', 'Goa', '403001', 15.4909, 73.8278],
  ['Nashik', 'Maharashtra', '422001', 19.9975, 73.7898],
  ['Nagpur', 'Maharashtra', '440001', 21.1458, 79.0882],
  ['Aurangabad', 'Maharashtra', '431001', 19.8762, 75.3433],
  ['Indore', 'Madhya Pradesh', '452001', 22.7196, 75.8577],
  ['Bhopal', 'Madhya Pradesh', '462001', 23.2599, 77.4126],
  ['Gwalior', 'Madhya Pradesh', '474001', 26.2183, 78.1828],
  ['Jabalpur', 'Madhya Pradesh', '482001', 23.1815, 79.9864],
  ['Raipur', 'Chhattisgarh', '492001', 21.2514, 81.6296],
  ['Bilaspur', 'Chhattisgarh', '495001', 22.0797, 82.1409],
  ['Ranchi', 'Jharkhand', '834001', 23.3441, 85.3096],
  ['Jamshedpur', 'Jharkhand', '831001', 22.8046, 86.2029],
  ['Patna', 'Bihar', '800001', 25.5941, 85.1376],
  ['Gaya', 'Bihar', '823001', 24.7914, 85.0002],
  ['Bhubaneswar', 'Odisha', '751001', 20.2961, 85.8245],
  ['Cuttack', 'Odisha', '753001', 20.4625, 85.8828],
  ['Guwahati', 'Assam', '781001', 26.1445, 91.7362],
  ['Shillong', 'Meghalaya', '793001', 25.5788, 91.8933],
  ['Imphal', 'Manipur', '795001', 24.817, 93.9368],
  ['Aizawl', 'Mizoram', '796001', 23.7271, 92.7176],
  ['Agartala', 'Tripura', '799001', 23.8315, 91.2868],
  ['Kohima', 'Nagaland', '797001', 25.6751, 94.1086],
  ['Itanagar', 'Arunachal Pradesh', '791111', 27.0844, 93.6053],
  ['Gangtok', 'Sikkim', '737101', 27.3389, 88.6065],
  ['Vijayawada', 'Andhra Pradesh', '520001', 16.5062, 80.648],
  ['Visakhapatnam', 'Andhra Pradesh', '530001', 17.6868, 83.2185],
  ['Tirupati', 'Andhra Pradesh', '517501', 13.6288, 79.4192],
  ['Guntur', 'Andhra Pradesh', '522001', 16.3067, 80.4365],
  ['Warangal', 'Telangana', '506002', 17.9689, 79.5941],
  ['Kochi', 'Kerala', '682001', 9.9312, 76.2673],
  ['Thiruvananthapuram', 'Kerala', '695001', 8.5241, 76.9366],
  ['Kozhikode', 'Kerala', '673001', 11.2588, 75.7804],
  ['Mysuru', 'Karnataka', '570001', 12.2958, 76.6394],
  ['Mangaluru', 'Karnataka', '575001', 12.9141, 74.856],
  ['Madurai', 'Tamil Nadu', '625001', 9.9252, 78.1198],
  ['Coimbatore', 'Tamil Nadu', '641001', 11.0168, 76.9558],
  ['Tiruchirappalli', 'Tamil Nadu', '620001', 10.7905, 78.7047],
  ['Salem', 'Tamil Nadu', '636001', 11.6643, 78.146],
  ['Puducherry', 'Puducherry', '605001', 11.9416, 79.8083],
];

const additionalGroups = [
  {
    countryCode: '+91',
    phonePrefix: '90000001',
    country: 'India',
    ownerNames: indiaOwners,
    locations: indiaLocations,
  },
  {
    countryCode: '+1',
    phonePrefix: '20255501',
    country: 'United States',
    ownerNames: [
      ['Marcus', 'Green'],
      ['Emily', 'Johnson'],
      ['Lucas', 'Hall'],
      ['Grace', 'Allen'],
      ['Caleb', 'Wright'],
      ['Chloe', 'Lewis'],
      ['Henry', 'Scott'],
      ['Nora', 'Adams'],
      ['Owen', 'Baker'],
      ['Stella', 'Rivera'],
    ],
    locations: [
      ['Philadelphia', 'Pennsylvania', '19103', 39.9526, -75.1652],
      ['Seattle', 'Washington', '98101', 47.6062, -122.3321],
      ['Houston', 'Texas', '77002', 29.7604, -95.3698],
      ['Austin', 'Texas', '78701', 30.2672, -97.7431],
      ['Boston', 'Massachusetts', '02108', 42.3601, -71.0589],
      ['Denver', 'Colorado', '80202', 39.7392, -104.9903],
      ['Miami', 'Florida', '33130', 25.7617, -80.1918],
      ['Atlanta', 'Georgia', '30303', 33.749, -84.388],
      ['Phoenix', 'Arizona', '85004', 33.4484, -112.074],
      ['Portland', 'Oregon', '97201', 45.5152, -122.6784],
    ],
  },
  {
    countryCode: '+1',
    phonePrefix: '41655502',
    country: 'Canada',
    ownerNames: [
      ['Liam', 'Parker'],
      ['Ava', 'Campbell'],
      ['Noah', 'Sinclair'],
      ['Sophie', 'Laurent'],
      ['Lucas', 'Fraser'],
      ['Emma', 'Wilson'],
      ['Oliver', 'Chen'],
      ['Ruby', 'Bennett'],
      ['Jack', 'Morrison'],
      ['Isla', 'Cooper'],
    ],
    locations: [
      ['Toronto', 'Ontario', 'M5H 2N2', 43.6532, -79.3832],
      ['Montreal', 'Quebec', 'H2Y 1C6', 45.5019, -73.5674],
      ['Vancouver', 'British Columbia', 'V6B 1A1', 49.2827, -123.1207],
      ['Calgary', 'Alberta', 'T2P 1J9', 51.0447, -114.0719],
      ['Ottawa', 'Ontario', 'K1P 1J1', 45.4215, -75.6972],
      ['Edmonton', 'Alberta', 'T5J 0N3', 53.5461, -113.4938],
      ['Quebec City', 'Quebec', 'G1R 4S9', 46.8139, -71.208],
      ['Winnipeg', 'Manitoba', 'R3B 1B9', 49.8951, -97.1384],
      ['Halifax', 'Nova Scotia', 'B3J 1S9', 44.6488, -63.5752],
      ['Saskatoon', 'Saskatchewan', 'S7K 0J5', 52.1332, -106.67],
    ],
  },
  {
    countryCode: '+61',
    phonePrefix: '04125503',
    country: 'Australia',
    ownerNames: [
      ['Jack', 'Fletcher'],
      ['Mia', 'Thompson'],
      ['Oliver', 'Hayes'],
      ['Ruby', 'Clarke'],
      ['Thomas', 'Nguyen'],
      ['Ella', 'Morgan'],
      ['Liam', 'Walsh'],
      ['Zoe', 'Fisher'],
      ['Nathan', 'Hughes'],
      ['Grace', 'Turner'],
    ],
    locations: [
      ['Sydney', 'New South Wales', '2000', -33.8688, 151.2093],
      ['Melbourne', 'Victoria', '3000', -37.8136, 144.9631],
      ['Brisbane', 'Queensland', '4000', -27.4698, 153.0251],
      ['Perth', 'Western Australia', '6000', -31.9505, 115.8605],
      ['Adelaide', 'South Australia', '5000', -34.9285, 138.6007],
      ['Canberra', 'Australian Capital Territory', '2601', -35.2809, 149.13],
      ['Hobart', 'Tasmania', '7000', -42.8821, 147.3272],
      ['Darwin', 'Northern Territory', '0800', -12.4634, 130.8456],
      ['Gold Coast', 'Queensland', '4217', -28.0167, 153.4],
      ['Newcastle', 'New South Wales', '2300', -32.9283, 151.7817],
    ],
  },
  {
    countryCode: '+1',
    phonePrefix: '41555504',
    country: 'United States',
    ownerNames: [
      ['Logan', 'Anderson'],
      ['Sophia', 'Ramirez'],
      ['Mason', 'Lee'],
      ['Ella', 'Thompson'],
      ['James', 'Nguyen'],
      ['Harper', 'Williams'],
      ['Alexander', 'Brown'],
      ['Evelyn', 'Garcia'],
      ['Carter', 'Robinson'],
      ['Lily', 'Martinez'],
    ],
    locations: [
      ['Long Beach', 'California', '90802', 33.7701, -118.1937],
      ['San Francisco', 'California', '94102', 37.7749, -122.4194],
      ['San Diego', 'California', '92101', 32.7157, -117.1611],
      ['Sacramento', 'California', '95814', 38.5816, -121.4944],
      ['San Jose', 'California', '95113', 37.3382, -121.8863],
      ['Fresno', 'California', '93721', 36.7378, -119.7871],
      ['Oakland', 'California', '94612', 37.8044, -122.2712],
      ['Irvine', 'California', '92612', 33.6846, -117.8265],
      ['Santa Barbara', 'California', '93101', 34.4208, -119.6982],
      ['Bakersfield', 'California', '93301', 35.3733, -119.0187],
    ],
  },
];

const additionalDemoShops = [];
let additionalShopIndex = 11;
for (const group of additionalGroups) {
  if (group.ownerNames.length !== group.locations.length) {
    throw new Error(`Demo owner/location count mismatch for ${group.country}.`);
  }

  group.locations.forEach((location, index) => {
    const [city, state, postalCode, latitude, longitude] = location;
    const [firstName, lastName] = group.ownerNames[index];
    const emailNumber = additionalShopIndex++;
    additionalDemoShops.push({
      firstName,
      lastName,
      city,
      state,
      country: group.country,
      postalCode,
      countryCode: group.countryCode,
      mobileNumber: `${group.phonePrefix}${String(index).padStart(2, '0')}`,
      address: `Demo Repair Centre, ${city} City Centre`,
      latitude,
      longitude,
      email: `demo.shop${String(emailNumber).padStart(2, '0')}@example.test`,
      shopName: `${firstName} ${lastName} Repair Studio`,
    });
  });
}

if (additionalDemoShops.length !== 100) {
  throw new Error(`Expected 100 additional demo Shops, got ${additionalDemoShops.length}.`);
}

const additionalCount = (predicate) =>
  additionalDemoShops.filter(predicate).length;
if (
  additionalCount((shop) => shop.country === 'India') !== 60 ||
  additionalCount(
    (shop) => shop.country === 'United States' && shop.state !== 'California',
  ) !== 10 ||
  additionalCount((shop) => shop.country === 'Canada') !== 10 ||
  additionalCount((shop) => shop.country === 'Australia') !== 10 ||
  additionalCount(
    (shop) => shop.country === 'United States' && shop.state === 'California',
  ) !== 10
) {
  throw new Error('Additional demo Shop location counts do not match the requested split.');
}

const allDemoShops = [...initialDemoShops, ...additionalDemoShops];
const uniqueOwners = new Set(
  allDemoShops.map((shop) => `${shop.firstName} ${shop.lastName}`),
);
const uniqueLocations = new Set(
  allDemoShops.map((shop) => `${shop.city}, ${shop.state}, ${shop.country}`),
);
const uniqueEmails = new Set(allDemoShops.map((shop) => shop.email));
if (
  uniqueOwners.size !== allDemoShops.length ||
  uniqueLocations.size !== allDemoShops.length ||
  uniqueEmails.size !== allDemoShops.length
) {
  throw new Error('Demo Shop names, locations, and emails must all be unique.');
}

const demoShops = process.argv.includes('--additional')
  ? additionalDemoShops
  : initialDemoShops;

function assertSafeConfiguration() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Set NODE_ENV=development before seeding demo Shops.');
  }
  if (process.env.SEED_DEMO_SHOPS_CONFIRM !== 'YES') {
    throw new Error('Set SEED_DEMO_SHOPS_CONFIRM=YES to confirm demo seeding.');
  }
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required; set it in backend/.env or the shell.');
  }

  const password = process.env.DEMO_SHOP_PASSWORD;
  if (
    !password ||
    Buffer.byteLength(password, 'utf8') < 8 ||
    Buffer.byteLength(password, 'utf8') > 72 ||
    !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+/.test(password)
  ) {
    throw new Error(
      'DEMO_SHOP_PASSWORD must be 8 to 72 UTF-8 bytes and include uppercase, lowercase, and a number.',
    );
  }
}

function registrationNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `PRX-${date}-${randomBytes(6).toString('hex').toUpperCase()}`;
}

async function seedDemoShops() {
  assertSafeConfiguration();

  const passwordHash = await bcrypt.hash(process.env.DEMO_SHOP_PASSWORD, 12);
  await mongoose.connect(process.env.MONGO_URI);

  const users = mongoose.connection.collection('users');
  const registrations = mongoose.connection.collection('registration_requests');
  let session;

  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const emails = demoShops.map((shop) => shop.email);
      const existing = await users
        .find(
          { email: { $in: emails } },
          { projection: { email: 1 }, session },
        )
        .toArray();
      if (existing.length) {
        throw new Error(
          `Found ${existing.length} existing demo Shop email(s); refusing to overwrite accounts.`,
        );
      }

      const now = new Date();
      const userDocuments = demoShops.map((shop) => ({
        _id: new mongoose.Types.ObjectId(),
        firstName: shop.firstName,
        lastName: shop.lastName,
        email: shop.email,
        passwordHash,
        accountType: 'shop',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
        countryCode: shop.countryCode,
        mobileNumber: shop.mobileNumber,
        location: { latitude: shop.latitude, longitude: shop.longitude },
        shopDetails: {
          shopName: shop.shopName,
          businessType: 'Electronics Repair Shop',
          description: 'Demo listing for shop discovery and location testing.',
          yearsOfExperience: 5,
          address: shop.address,
          street: shop.address,
          area: 'City Centre',
          city: shop.city,
          state: shop.state,
          country: shop.country,
          postalCode: shop.postalCode,
          landmark: 'Near the city centre',
          services: [
            'Mobile Phone Repair',
            'Computer Repair',
            'Appliance Repair',
          ],
          location: { latitude: shop.latitude, longitude: shop.longitude },
        },
        createdAt: now,
        updatedAt: now,
      }));

      const registrationDocuments = userDocuments.map((user) => ({
        _id: new mongoose.Types.ObjectId(),
        userId: user._id,
        accountType: 'shop',
        registrationNumber: registrationNumber(),
        registrationStatus: 'approved',
        submittedAt: now,
        reviewedAt: now,
        adminRemarks: 'Demo seed: payment status simulated; no Stripe charge.',
        paymentStatus: 'paid',
        paymentAmountCents: 2900,
        paymentCurrency: 'usd',
        paidAt: now,
        paymentRefundedAmountCents: 0,
        processedStripeEventIds: [],
        createdAt: now,
        updatedAt: now,
      }));

      await users.insertMany(userDocuments, { session, ordered: true });
      await registrations.insertMany(registrationDocuments, {
        session,
        ordered: true,
      });
    });
  } finally {
    if (session) {
      await session.endSession();
    }
    await mongoose.disconnect();
  }

  console.log(
    `Seeded ${demoShops.length} demo Shop accounts${process.argv.includes('--additional') ? ' (additional batch)' : ''}.`,
  );
  console.log('Payment status is simulated; no Stripe charges or invoices were created.');
  console.log('Login emails:');
  for (const shop of demoShops) {
    console.log(`  ${shop.email} — ${shop.city}, ${shop.country}`);
  }
}

seedDemoShops().catch((error) => {
  console.error(`Demo Shop seeding failed: ${error.message}`);
  process.exitCode = 1;
});
