export async function GET() {
  return Response.json({ message: 'Appointments API' });
}

export async function POST(request) {
  return Response.json({ message: 'Appointment created' });
}
