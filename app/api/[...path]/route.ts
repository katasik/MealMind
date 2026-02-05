import { NextRequest, NextResponse } from 'next/server';

// Proxy all API requests to Python server with extended timeout
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToPython(request, path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToPython(request, path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToPython(request, path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToPython(request, path, 'DELETE');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

async function proxyToPython(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    const path = pathSegments.join('/');
    const url = `http://localhost:5001/api/${path}`;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    // Get request body for POST/PUT
    let body: string | undefined;
    if (method === 'POST' || method === 'PUT') {
      body = JSON.stringify(await request.json());
    }

    // Extended timeout for long-running operations (2 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Python server returned non-JSON (e.g. HTML error page or plain text)
      return NextResponse.json(
        { success: false, error: text.slice(0, 200) || 'Python server returned non-JSON response' },
        { status: response.status >= 400 ? response.status : 502 }
      );
    }

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { success: false, error: 'Request timeout - operation took too long' },
        { status: 504 }
      );
    }

    console.error('Error proxying to Python server:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to connect to API server. Make sure the Python server is running on port 5001.'
      },
      { status: 500 }
    );
  }
}
