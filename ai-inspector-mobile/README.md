# AI Inspector Mobile

React Native + Expo mobile application for the AI Inspector project.

## Included Screens

- Home dashboard
- New inspection camera
- Gallery upload
- Inspection result (Good / Damaged)
- History + filtering
- Statistics
- Profile

## Technologies Used

### Frontend

- React
- React Native
- Expo
- Expo Camera
- Expo Image Picker
- Expo Image Manipulator
- React Navigation

## How to Run the Mobile App

### 1. Requirements

Before running the project, install:

- Node.js
- npm
- Expo Go on your iPhone or Android phone

### 2. Clone the Repository

```bash
git clone <repository-url>
```

Then enter the project directory:

```bash
cd ai-inspector-mobile
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Check the Expo Project

```bash
npx expo-doctor
```

### 5. Start the App

```bash
npx expo start
```

A QR code will appear.

Open **Expo Go** on your phone and scan the QR code.

If the phone cannot connect to the development server over the local network, try:

```bash
npx expo start --tunnel
```

## Folder Structure

```text
src/
  components/
  data/
  screens/
  services/
  theme/

assets/
```