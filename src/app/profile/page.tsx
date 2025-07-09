import { redirect } from 'next/navigation';

export default function ProfileRootPage() {
  // Option 1: Redirect to homepage
  redirect('/');
  // Option 2: Show a message instead (uncomment below to use)
  // return <div style={{textAlign:'center',marginTop:40}}><h2>Please select a user profile to view.</h2></div>;
} 